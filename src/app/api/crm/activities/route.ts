import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const activities = await db.activity.findMany({
    where: { workspaceId },
    include: { actor: true, lead: true, contact: true, deal: true, company: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return ok(serialize(activities))
}
