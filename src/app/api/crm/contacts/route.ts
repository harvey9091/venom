import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const contacts = await db.contact.findMany({
    where: { workspaceId, ...(q ? { OR: [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
    ] } : {}) },
    include: { company: true },
    orderBy: { createdAt: 'desc' },
  })
  return ok(serialize(contacts))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const contact = await db.contact.create({ data: { workspaceId, ...payload } })
  return ok(serialize(contact))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return fail('id required', 400)
  const contact = await db.contact.update({ where: { id }, data: patch })
  return ok(serialize(contact))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.contact.delete({ where: { id } })
  return ok({ id })
}
