import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const automations = await db.automation.findMany({
    where: { workspaceId },
    include: { logs: { take: 10, orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return ok(serialize(automations.map((a) => ({
    ...a,
    graph: a.graph || { nodes: [], edges: [] },
  }))))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, name, description, triggerType, graph } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const automation = await db.automation.create({
    data: {
      workspaceId,
      name,
      description,
      triggerType: triggerType || 'lead_created',
      graph: graph || { nodes: [], edges: [] },
    },
  })
  return ok(serialize(automation))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, name, description, enabled, triggerType, graph } = body
  if (!id) return fail('id required', 400)
  const automation = await db.automation.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(triggerType !== undefined ? { triggerType } : {}),
      ...(graph !== undefined ? { graph } : {}),
    },
  })
  return ok(serialize(automation))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.automation.delete({ where: { id } })
  return ok({ id })
}
