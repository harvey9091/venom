import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const events = await db.calendarEvent.findMany({
    where: { workspaceId },
    include: { meetings: { include: { contact: true, host: true } } },
    orderBy: { startAt: 'asc' },
  })
  return ok(serialize(events))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const event = await db.calendarEvent.create({ data: { workspaceId, ...payload } })
  return ok(serialize(event))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return fail('id required', 400)
  const event = await db.calendarEvent.update({ where: { id }, data: patch })
  return ok(serialize(event))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.calendarEvent.delete({ where: { id } })
  return ok({ id })
}
