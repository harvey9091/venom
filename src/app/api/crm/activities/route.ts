import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const activities = await db.activity.findMany({
      where: { workspaceId },
      include: { actor: true, lead: true, contact: true, deal: true, company: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return ok(serialize(activities))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Activities GET error:', error)
    return fail('Internal server error', 500)
  }
}
