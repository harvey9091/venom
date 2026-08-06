import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, withRateLimit, sanitizeString } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    const notifs = await db.notification.findMany({
      where: { workspaceId, ...(userId ? { userId: sanitizeString(userId, 100) } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return ok(serialize(notifs))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Notifications GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function PATCH(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { id, read, markAllForUserId } = body
    if (markAllForUserId) {
      const membership = await db.membership.findFirst({
        where: { userId: markAllForUserId, workspaceId },
      })
      if (!membership) {
        return fail('Cannot mark notifications for user not in workspace', 403)
      }
      await db.notification.updateMany({ where: { userId: markAllForUserId }, data: { read: true } })
      return ok({ marked: 'all' })
    }
    if (!id) return fail('id required', 400)
    const notif = await db.notification.update({ where: { id }, data: { read } })
    return ok(serialize(notif))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Notifications PATCH error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const notif = await db.notification.create({ data: { workspaceId, ...payload } })
    return ok(serialize(notif))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Notifications POST error:', error)
    return fail('Internal server error', 500)
  }
}
