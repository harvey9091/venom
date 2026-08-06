import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const q = sanitizeSearchQuery(url.searchParams.get('q') || '')
    const companies = await db.company.findMany({
      where: {
        workspaceId,
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { domain: { contains: q } },
          ],
        } : {}),
      },
      orderBy: { name: 'asc' },
    })
    return ok(serialize(companies))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Companies GET error:', error)
    return fail('Internal server error', 500)
  }
}
