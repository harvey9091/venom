/**
 * GET /api/crm/companies?workspaceId=...&q=...
 *
 * Lightweight read-only list endpoint for populating dropdowns/selects
 * in the Lead/Deal/Note drawers. The standalone Companies page was removed
 * in Phase 2, but the Company model still exists (linked to leads/deals).
 */
import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const companies = await db.company.findMany({
    where: { workspaceId, ...(q ? { name: { contains: q } } : {}) },
    select: {
      id: true,
      name: true,
      domain: true,
      industry: true,
      size: true,
      revenue: true,
      website: true,
      city: true,
      country: true,
      status: true,
    },
    orderBy: { name: 'asc' },
    take: 100,
  })
  return ok(serialize(companies))
}
