/**
 * GET /api/crm/bootstrap
 * Returns demo identity (first user + their primary workspace + tags + members).
 * In production this would be replaced by Supabase Auth session resolution.
 */
import { db, ok, serialize } from '@/lib/api'

export async function GET() {
  const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) return ok({ user: null, workspace: null, members: [], tags: [] })

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })
  const workspace = membership?.workspace || null
  const workspaceId = workspace?.id

  const [members, tags] = workspaceId
    ? await Promise.all([
        db.membership.findMany({ where: { workspaceId }, include: { user: true } }),
        db.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } }),
      ])
    : [[], []]

  return ok(serialize({ user, workspace, members, tags }))
}
