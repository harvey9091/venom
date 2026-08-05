/**
 * GET /api/crm/contacts?workspaceId=...&q=...
 *
 * Lightweight read-only list endpoint for populating dropdowns/selects
 * in the Lead/Deal/Note drawers. The standalone Contacts page was removed
 * in Phase 2, but the Contact model still exists (linked to leads/deals).
 */
import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const contacts = await db.contact.findMany({
    where: {
      workspaceId,
      ...(q ? { OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
      ] } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      jobTitle: true,
      companyId: true,
      status: true,
    },
    orderBy: { firstName: 'asc' },
    take: 100,
  })
  return ok(serialize(contacts))
}
