import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const tags = await db.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } })
  return ok(serialize(tags))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, name, color } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const tag = await db.tag.create({ data: { workspaceId, name, color: color || '#64748b' } })
  return ok(serialize(tag))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.tag.delete({ where: { id } })
  return ok({ id })
}
