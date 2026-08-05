import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const tasks = await db.task.findMany({
    where: {
      workspaceId,
      parentTaskId: null,
      ...(status ? { status } : {}),
    },
    include: {
      assignee: true,
      owner: true,
      creator: true,
      deal: true,
      subtasks: { orderBy: { order: 'asc' } },
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { order: 'asc' },
  })
  return ok(serialize(tasks))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const task = await db.task.create({ data: { workspaceId, ...payload } })
  return ok(serialize(task))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return fail('id required', 400)
  const task = await db.task.update({ where: { id }, data: patch })
  return ok(serialize(task))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.task.delete({ where: { id } })
  return ok({ id })
}
