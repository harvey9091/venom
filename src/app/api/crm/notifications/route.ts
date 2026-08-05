import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const notifs = await db.notification.findMany({
    where: { workspaceId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return ok(serialize(notifs))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, read, markAllForUserId } = body
  if (markAllForUserId) {
    await db.notification.updateMany({ where: { userId: markAllForUserId }, data: { read: true } })
    return ok({ marked: 'all' })
  }
  if (!id) return fail('id required', 400)
  const notif = await db.notification.update({ where: { id }, data: { read } })
  return ok(serialize(notif))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const notif = await db.notification.create({ data: { workspaceId, ...payload } })
  return ok(serialize(notif))
}
