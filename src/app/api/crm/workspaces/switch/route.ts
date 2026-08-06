import { db, ok, fail, requireAuth, serialize } from '@/lib/api'

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { workspaceId } = body

    if (!workspaceId) {
      return fail('workspaceId is required', 400)
    }

    const membership = await db.membership.findFirst({
      where: { userId: user.id, workspaceId },
      include: { workspace: true },
    })

    if (!membership) {
      return fail('Forbidden', 403)
    }

    return ok(serialize({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      role: membership.role,
    }))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Workspace switch error:', error)
    return fail('Internal server error', 500)
  }
}
