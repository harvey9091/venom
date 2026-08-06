import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, withRateLimit, sanitizeString } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const q = sanitizeSearchQuery(url.searchParams.get('q') || '')
    const status = url.searchParams.get('status')
    const leads = await db.lead.findMany({
      where: {
        workspaceId,
        ...(q ? { OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ] } : {}),
        ...(status ? { status: sanitizeString(status, 50) } : {}),
      },
      include: {
        owner: true,
        assignedUser: true,
        contact: { include: { company: true } },
        company: true,
        convertedDeal: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(serialize(leads))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Leads GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const lead = await db.lead.create({ data: { workspaceId, ...payload } })
    await db.activity.create({
      data: {
        workspaceId,
        actorId: payload.ownerId || null,
        leadId: lead.id,
        type: 'created',
        summary: `created lead ${lead.fullName}`,
      },
    })
    if (lead.estimatedValue && lead.estimatedValue > 0) {
      await autoCreateDealForLead(lead, workspaceId)
    }
    return ok(serialize(lead))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Leads POST error:', error)
    return fail('Internal server error', 500)
  }
}

export async function PATCH(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { id, ...patch } = body
    if (!id) return fail('id required', 400)
    const before = await db.lead.findUnique({ where: { id } })
    const lead = await db.lead.update({ where: { id }, data: patch })
    if (patch.status) {
      await db.activity.create({
        data: {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          type: 'status_changed',
          summary: `moved ${lead.fullName} to ${patch.status}`,
        },
      })
    }
    if (patch.estimatedValue !== undefined || patch.expectedClose !== undefined || patch.status !== undefined) {
      if (lead.convertedDealId) {
        const dealPatch: any = {}
        if (patch.estimatedValue !== undefined) dealPatch.amount = patch.estimatedValue
        if (patch.expectedClose !== undefined) dealPatch.expectedClose = patch.expectedClose
        if (patch.status === 'won' || patch.status === 'lost') {
          dealPatch.closeReason = patch.status
          dealPatch.closedAt = new Date()
          const wonStage = await db.stage.findFirst({ where: { pipeline: { workspaceId: lead.workspaceId }, isWon: true } })
          const lostStage = await db.stage.findFirst({ where: { pipeline: { workspaceId: lead.workspaceId }, isLost: true } })
          if (patch.status === 'won' && wonStage) dealPatch.stageId = wonStage.id
          if (patch.status === 'lost' && lostStage) dealPatch.stageId = lostStage.id
        }
        await db.deal.update({ where: { id: lead.convertedDealId }, data: dealPatch })
      } else if (lead.estimatedValue && lead.estimatedValue > 0 && (before?.estimatedValue !== lead.estimatedValue)) {
        await autoCreateDealForLead(lead, lead.workspaceId)
      }
    }
    return ok(serialize(lead))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Leads PATCH error:', error)
    return fail('Internal server error', 500)
  }
}

export async function DELETE(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { id } = body
    if (!id) return fail('id required', 400)
    await db.lead.delete({ where: { id } })
    return ok({ id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Leads DELETE error:', error)
    return fail('Internal server error', 500)
  }
}

async function autoCreateDealForLead(lead: any, workspaceId: string) {
  let pipeline = await db.pipeline.findFirst({ where: { workspaceId, isDefault: true }, include: { stages: { orderBy: { order: 'asc' } } } })
  if (!pipeline) {
    pipeline = await db.pipeline.findFirst({ where: { workspaceId }, include: { stages: { orderBy: { order: 'asc' } } } })
  }
  if (!pipeline || !pipeline.stages.length) return
  const firstStage = pipeline.stages[0]
  let stage = firstStage
  const statusToStage: Record<string, string> = {
    proposal_sent: 'Proposal',
    negotiation: 'Negotiation',
    won: 'Closed Won',
    lost: 'Closed Lost',
    qualified: 'Qualified',
    contacted: 'Demo',
  }
  const targetStageName = statusToStage[lead.status || '']
  if (targetStageName) {
    const match = pipeline.stages.find((s: any) => s.name.toLowerCase().includes(targetStageName.toLowerCase()))
    if (match) stage = match
  }
  const deal = await db.deal.create({
    data: {
      workspaceId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      contactId: lead.contactId || null,
      companyId: lead.companyId || null,
      ownerId: lead.ownerId || null,
      title: `${lead.fullName} — Deal`,
      amount: lead.estimatedValue || 0,
      currency: 'INR',
      probability: stage.probability,
      expectedClose: lead.expectedClose || null,
      closedAt: lead.status === 'won' || lead.status === 'lost' ? new Date() : null,
      closeReason: lead.status === 'won' ? 'won' : lead.status === 'lost' ? 'lost' : null,
    },
  })
  await db.lead.update({ where: { id: lead.id }, data: { convertedDealId: deal.id } })
}
