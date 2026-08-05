/**
 * Companies API
 *  GET    /api/crm/companies?workspaceId=...&q=...
 *  POST   /api/crm/companies   { workspaceId, ...payload }
 *  PATCH  /api/crm/companies   { id, ...patch }
 *  DELETE /api/crm/companies   { id }
 */
import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const companies = await db.company.findMany({
    where: { workspaceId, ...(q ? { name: { contains: q } } : {}) },
    include: { contacts: true },
    orderBy: { createdAt: 'desc' },
  })
  return ok(serialize(companies))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const company = await db.company.create({ data: { workspaceId, ...payload } })
  return ok(serialize(company))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return fail('id required', 400)
  const company = await db.company.update({ where: { id }, data: patch })
  return ok(serialize(company))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.company.delete({ where: { id } })
  return ok({ id })
}
