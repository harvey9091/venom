import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const pinnedOnly = url.searchParams.get('pinned') === '1'
  const notes = await db.note.findMany({
    where: { workspaceId, ...(pinnedOnly ? { pinned: true } : {}) },
    include: { author: true, lead: true, contact: true, deal: true, company: true },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  })
  return ok(serialize(notes))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const note = await db.note.create({ data: { workspaceId, ...payload } })
  return ok(serialize(note))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return fail('id required', 400)
  const note = await db.note.update({ where: { id }, data: patch })
  return ok(serialize(note))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.note.delete({ where: { id } })
  return ok({ id })
}
