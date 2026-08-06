import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const pipelines = await db.pipeline.findMany({
    where: { workspaceId },
    include: { stages: { orderBy: { order: 'asc' } }, deals: true },
    orderBy: { createdAt: 'asc' },
  })
  return ok(serialize(pipelines))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, name, description, stages } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const pipeline = await db.pipeline.create({
    data: {
      workspaceId,
      name,
      description,
      stages: stages?.length
        ? { create: stages.map((s: any, i: number) => ({ ...s, order: i }))}
        : undefined,
    },
    include: { stages: true },
  })
  return ok(serialize(pipeline))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, name, description, stages } = body
  if (!id) return fail('id required', 400)
  if (stages) {
    // Replace all stages
    await db.stage.deleteMany({ where: { pipelineId: id } })
    for (let i = 0; i < stages.length; i++) {
      await db.stage.create({ data: { ...stages[i], pipelineId: id, order: i } })
    }
  }
  const pipeline = await db.pipeline.update({
    where: { id },
    data: { name, description },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  return ok(serialize(pipeline))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.pipeline.delete({ where: { id } })
  return ok({ id })
}
