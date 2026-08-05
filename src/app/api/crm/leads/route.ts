import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const status = url.searchParams.get('status')
  const leads = await db.lead.findMany({
    where: {
      workspaceId,
      ...(q ? { OR: [
        { fullName: { contains: q } },
        { email: { contains: q } },
      ] } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      owner: true,
      contact: { include: { company: true } },
      company: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return ok(serialize(leads))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, ...payload } = body
  if (!workspaceId) return fail('workspaceId required', 400)
  const lead = await db.lead.create({ data: { workspaceId, ...payload } })
  await db.activity.create({
    data: {
      workspaceId,
      actorId: payload.ownerId || null,
      leadId: lead.id,
      type: 'created',
      summary: `created lead ${lead.fullName}`,
    },
  })
  return ok(serialize(lead))
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return fail('id required', 400)
  const lead = await db.lead.update({ where: { id }, data: patch })
  if (patch.status) {
    await db.activity.create({
      data: {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        type: 'status_changed',
        summary: `moved ${lead.fullName} to ${patch.status}`,
      },
    })
  }
  return ok(serialize(lead))
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body
  if (!id) return fail('id required', 400)
  await db.lead.delete({ where: { id } })
  return ok({ id })
}
