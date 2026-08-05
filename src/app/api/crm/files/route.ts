import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const files = await db.file.findMany({
    where: { workspaceId },
    include: { uploader: true, lead: true },
    orderBy: { createdAt: 'desc' },
  })
  return ok(serialize(files))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const file = await db.file.create({ data: { workspaceId, ...payload } })
  return ok(serialize(file))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.file.delete({ where: { id } })
  return ok({ id })
}
