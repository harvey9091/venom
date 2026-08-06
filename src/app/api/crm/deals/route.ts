import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, withRateLimit, sanitizeString } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const pipelineId = url.searchParams.get('pipelineId')
    const deals = await db.deal.findMany({
      where: { workspaceId, ...(pipelineId ? { pipelineId: sanitizeString(pipelineId, 100) } : {}) },
      include: {
        stage: true,
        owner: true,
        contact: { include: { company: true } },
        company: true,
        pipeline: { include: { stages: { orderBy: { order: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(serialize(deals))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Deals GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const deal = await db.deal.create({ data: { workspaceId, ...payload } })
    return ok(serialize(deal))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Deals POST error:', error)
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
    const deal = await db.deal.update({ where: { id }, data: patch })
    if (patch.stageId) {
      const stage = await db.stage.findUnique({ where: { id: patch.stageId } })
      if (stage) {
        await db.activity.create({
          data: {
            workspaceId: deal.workspaceId,
            dealId: deal.id,
            type: 'pipeline_changed',
            summary: `moved deal "${deal.title}" to ${stage.name}`,
          },
        })
      }
    }
    return ok(serialize(deal))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Deals PATCH error:', error)
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
    await db.deal.delete({ where: { id } })
    return ok({ id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Deals DELETE error:', error)
    return fail('Internal server error', 500)
  }
}
