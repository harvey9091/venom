/**
 * Global search across leads, companies, deals, contacts, notes, files, tasks.
 * GET /api/crm/search?q=...&workspaceId=...
 */
import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (!q) return ok({ leads: [], companies: [], deals: [], contacts: [], notes: [], files: [], tasks: [] })

  const [leads, companies, deals, contacts, notes, files, tasks] = await Promise.all([
    db.lead.findMany({
      where: { workspaceId, OR: [{ fullName: { contains: q } }, { email: { contains: q } }] },
      take: 6,
    }),
    db.company.findMany({ where: { workspaceId, name: { contains: q } }, take: 6 }),
    db.deal.findMany({ where: { workspaceId, title: { contains: q } }, take: 6 }),
    db.contact.findMany({
      where: { workspaceId, OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] },
      take: 6,
    }),
    db.note.findMany({ where: { workspaceId, OR: [{ title: { contains: q } }, { body: { contains: q } }] }, take: 6 }),
    db.file.findMany({ where: { workspaceId, name: { contains: q } }, take: 6 }),
    db.task.findMany({ where: { workspaceId, title: { contains: q } }, take: 6 }),
  ])

  return ok(serialize({ leads, companies, deals, contacts, notes, files, tasks }))
}
