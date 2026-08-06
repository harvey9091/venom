import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const q = sanitizeSearchQuery(url.searchParams.get('q') || '')
    const contacts = await db.contact.findMany({
      where: {
        workspaceId,
        ...(q ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
          ],
        } : {}),
      },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    })
    return ok(serialize(contacts))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Contacts GET error:', error)
    return fail('Internal server error', 500)
  }
}
