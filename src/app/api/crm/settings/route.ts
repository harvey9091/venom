/**
 * Settings API — workspace, members, custom fields, audit logs, api keys, users.
 */
import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'
import { createHash, randomBytes } from 'crypto'

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  const section = url.searchParams.get('section') || 'workspace'

  if (section === 'workspace') {
    const ws = await db.workspace.findUnique({ where: { id: workspaceId } })
    return ok(serialize(ws))
  }
  if (section === 'members') {
    const members = await db.membership.findMany({
      where: { workspaceId },
      include: { user: true },
    })
    return ok(serialize(members))
  }
  if (section === 'users') {
    const users = await db.user.findMany()
    return ok(serialize(users))
  }
  if (section === 'customFields') {
    const fields = await db.customField.findMany({ where: { workspaceId } })
    return ok(serialize(fields))
  }
  if (section === 'audit') {
    const logs = await db.auditLog.findMany({
      where: { workspaceId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return ok(serialize(logs))
  }
  if (section === 'apiKeys') {
    const keys = await db.apiKey.findMany({
      where: { workspaceId },
      include: { creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return ok(serialize(keys.map((k) => ({ ...k, hashedKey: undefined }))))
  }
  return fail('unknown section', 400)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, action, ...payload } = body

  if (action === 'createApiKey') {
    const rawKey = 'pk_live_' + randomBytes(24).toString('hex')
    const apiKey = await db.apiKey.create({
      data: {
        workspaceId,
        creatorId: payload.creatorId,
        name: payload.name,
        prefix: rawKey.slice(0, 12),
        hashedKey: createHash('sha256').update(rawKey).digest('hex'),
      },
    })
    return ok(serialize({ ...apiKey, rawKey }))
  }
  if (action === 'createCustomField') {
    const cf = await db.customField.create({ data: { workspaceId, ...payload } })
    return ok(serialize(cf))
  }
  if (action === 'inviteMember') {
    // For demo: create user if not exists, then add membership
    let user = await db.user.findUnique({ where: { email: payload.email } })
    if (!user) {
      user = await db.user.create({ data: { email: payload.email, name: payload.name || payload.email.split('@')[0] } })
    }
    const m = await db.membership.create({
      data: { workspaceId, userId: user.id, role: payload.role || 'member' },
      include: { user: true },
    })
    return ok(serialize(m))
  }
  if (action === 'updateWorkspace') {
    const ws = await db.workspace.update({ where: { id: workspaceId }, data: payload })
    return ok(serialize(ws))
  }
  return fail('unknown action', 400)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { action, id, ...patch } = body
  if (action === 'updateMember') {
    const m = await db.membership.update({ where: { id }, data: { role: patch.role } })
    return ok(serialize(m))
  }
  if (action === 'updateCustomField') {
    const cf = await db.customField.update({ where: { id }, data: patch })
    return ok(serialize(cf))
  }
  return fail('unknown action', 400)
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { action, id } = body
  if (action === 'revokeApiKey') {
    await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
    return ok({ id })
  }
  if (action === 'removeMember') {
    await db.membership.delete({ where: { id } })
    return ok({ id })
  }
  if (action === 'deleteCustomField') {
    await db.customField.delete({ where: { id } })
    return ok({ id })
  }
  if (action === 'deleteWorkspace') {
    await db.workspace.delete({ where: { id } })
    return ok({ id })
  }
  return fail('unknown action', 400)
}
