import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const status = url.searchParams.get('status')
  const leads = await db.lead.findMany({
    where: {
      workspaceId,
      ...(q ? { OR: [
        { fullName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ] } : {}),
      ...(status ? { status } : {}),
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
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
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
  // AUTO-DEAL CREATION: if lead has estimatedValue, auto-create a Deal
  if (lead.estimatedValue && lead.estimatedValue > 0) {
    await autoCreateDealForLead(lead, workspaceId)
  }
  return ok(serialize(lead))
}

export async function PATCH(req: Request) {
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
  // AUTO-DEAL SYNC:
  //  - If estimatedValue is set/changed and lead has no deal yet → create one
  //  - If lead already has a convertedDeal → sync amount + expectedClose + status
  if (patch.estimatedValue !== undefined || patch.expectedClose !== undefined || patch.status !== undefined) {
    if (lead.convertedDealId) {
      // Sync existing deal
      const dealPatch: any = {}
      if (patch.estimatedValue !== undefined) dealPatch.amount = patch.estimatedValue
      if (patch.expectedClose !== undefined) dealPatch.expectedClose = patch.expectedClose
      if (patch.status === 'won' || patch.status === 'lost') {
        dealPatch.closeReason = patch.status
        dealPatch.closedAt = new Date()
        // Move deal to won/lost stage
        const wonStage = await db.stage.findFirst({ where: { pipeline: { workspaceId: lead.workspaceId }, isWon: true } })
        const lostStage = await db.stage.findFirst({ where: { pipeline: { workspaceId: lead.workspaceId }, isLost: true } })
        if (patch.status === 'won' && wonStage) dealPatch.stageId = wonStage.id
        if (patch.status === 'lost' && lostStage) dealPatch.stageId = lostStage.id
      }
      await db.deal.update({ where: { id: lead.convertedDealId }, data: dealPatch })
    } else if (lead.estimatedValue && lead.estimatedValue > 0 && (before?.estimatedValue !== lead.estimatedValue)) {
      // Create new deal
      await autoCreateDealForLead(lead, lead.workspaceId)
    }
  }
  return ok(serialize(lead))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.lead.delete({ where: { id } })
  return ok({ id })
}

/**
 * Auto-create a Deal from a Lead. Picks the default pipeline's first stage,
 * sets the amount from lead.estimatedValue, expectedClose from lead.expectedClose,
 * and links back via convertedDealId.
 */
async function autoCreateDealForLead(lead: any, workspaceId: string) {
  // Find default pipeline
  let pipeline = await db.pipeline.findFirst({ where: { workspaceId, isDefault: true }, include: { stages: { orderBy: { order: 'asc' } } } })
  if (!pipeline) {
    pipeline = await db.pipeline.findFirst({ where: { workspaceId }, include: { stages: { orderBy: { order: 'asc' } } } })
  }
  if (!pipeline || !pipeline.stages.length) return
  const firstStage = pipeline.stages[0]
  // Map lead status → stage
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
    const match = pipeline.stages.find((s) => s.name.toLowerCase().includes(targetStageName.toLowerCase()))
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
