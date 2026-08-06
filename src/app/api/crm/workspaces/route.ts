import { db, ok, fail, requireAuth, serialize } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const user = await requireAuth()
    const memberships = await db.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    })

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      plan: m.workspace.plan,
      role: m.role,
      joinedAt: m.joinedAt,
    }))

    return ok(serialize(workspaces))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Workspaces GET error:', error)
    return fail('Internal server error', 500)
  }
}
