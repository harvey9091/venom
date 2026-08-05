import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const pipelineId = url.searchParams.get('pipelineId')
  const deals = await db.deal.findMany({
    where: { workspaceId, ...(pipelineId ? { pipelineId } : {}) },
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
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const deal = await db.deal.create({ data: { workspaceId, ...payload } })
  return ok(serialize(deal))
}

export async function PATCH(req: Request) {
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
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.deal.delete({ where: { id } })
  return ok({ id })
}
