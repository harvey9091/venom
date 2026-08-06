import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, sanitizeString } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const q = sanitizeSearchQuery(url.searchParams.get('q') || '')
    const type = url.searchParams.get('type') || ''

    const query: any = { workspaceId }

    if (q) {
      query.OR = [
        { title: { contains: q } },
        { body: { contains: q } },
      ]
    }

    if (type) {
      query.type = sanitizeString(type, 50)
    }

    const results = await db.calendarEvent.findMany({
      where: query,
      include: { meetings: { include: { contact: true, host: true } } },
      orderBy: { startAt: 'asc' },
    })
    return ok(serialize(results))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Search GET error:', error)
    return fail('Internal server error', 500)
  }
}
