import { db, ok, fail, requireWorkspace, requireWorkspaceRole, serialize, withRateLimit } from '@/lib/api'
import { createHash, randomBytes } from 'crypto'
import { settingsUpdateWorkspaceSchema, settingsInviteMemberSchema, settingsUpdateMemberSchema, settingsCreateCustomFieldSchema, settingsCreateApiKeySchema, deleteWorkspaceSchema } from '@/lib/validation-schemas'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
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
      const members = await db.membership.findMany({
        where: { workspaceId },
        include: { user: true },
      })
      const users = members.map((m) => m.user)
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Settings GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { action, ...payload } = body

    if (action === 'createApiKey') {
      const validation = settingsCreateApiKeySchema.safeParse(payload)
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      const rawKey = 'pk_live_' + randomBytes(24).toString('hex')
      const apiKey = await db.apiKey.create({
        data: {
          workspaceId,
          creatorId: validation.data.creatorId,
          name: validation.data.name,
          prefix: rawKey.slice(0, 12),
          hashedKey: createHash('sha256').update(rawKey).digest('hex'),
        },
      })
      const isProduction = process.env.NODE_ENV === 'production'
      return ok(serialize({
        ...apiKey,
        rawKey: isProduction ? undefined : rawKey,
        warning: isProduction ? 'API key generated. Store it securely — it will not be shown again.' : undefined,
      }))
    }
    if (action === 'createCustomField') {
      const validation = settingsCreateCustomFieldSchema.safeParse(payload)
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      const cf = await db.customField.create({ data: { workspaceId, ...validation.data } })
      return ok(serialize(cf))
    }
    if (action === 'inviteMember') {
      const validation = settingsInviteMemberSchema.safeParse(payload)
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      let user = await db.user.findUnique({ where: { email: validation.data.email } })
      if (!user) {
        user = await db.user.create({ data: { email: validation.data.email, name: validation.data.name || validation.data.email.split('@')[0] } })
      }
      const m = await db.membership.create({
        data: { workspaceId, userId: user.id, role: validation.data.role || 'member' },
        include: { user: true },
      })
      return ok(serialize(m))
    }
    if (action === 'updateWorkspace') {
      const { role } = await requireWorkspaceRole(req, ['owner', 'admin'])
      const validation = settingsUpdateWorkspaceSchema.safeParse(payload)
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      const ws = await db.workspace.update({ where: { id: workspaceId }, data: validation.data })
      return ok(serialize(ws))
    }
    return fail('unknown action', 400)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return fail('Forbidden', 403)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Settings POST error:', error)
    return fail('Internal server error', 500)
  }
}

export async function PATCH(req: Request) {
  try {
    await withRateLimit(req)
    const { workspaceId, role } = await requireWorkspaceRole(req, ['owner', 'admin'])
    const body = await req.json()
    const { action, id, ...patch } = body
    if (action === 'updateMember') {
      const validation = settingsUpdateMemberSchema.safeParse({ id, ...patch })
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      // Prevent removing the last owner
      if (validation.data.role && validation.data.role !== 'owner') {
        const member = await db.membership.findUnique({ where: { id: validation.data.id } })
        if (member?.role === 'owner') {
          const ownerCount = await db.membership.count({ where: { workspaceId, role: 'owner' } })
          if (ownerCount <= 1) {
            return fail('Cannot remove the last owner', 400)
          }
        }
      }
      const m = await db.membership.update({ where: { id: validation.data.id }, data: { role: validation.data.role } })
      return ok(serialize(m))
    }
    if (action === 'updateCustomField') {
      const validation = settingsCreateCustomFieldSchema.safeParse(patch)
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      const cf = await db.customField.update({ where: { id }, data: validation.data })
      return ok(serialize(cf))
    }
    return fail('unknown action', 400)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return fail('Forbidden', 403)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Settings PATCH error:', error)
    return fail('Internal server error', 500)
  }
}

export async function DELETE(req: Request) {
  try {
    await withRateLimit(req)
    const { workspaceId, role } = await requireWorkspaceRole(req, ['owner'])
    const body = await req.json()
    const { action, id } = body
    if (action === 'revokeApiKey') {
      await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
      return ok({ id })
    }
    if (action === 'removeMember') {
      const member = await db.membership.findUnique({ where: { id } })
      if (member?.role === 'owner') {
        const ownerCount = await db.membership.count({ where: { workspaceId, role: 'owner' } })
        if (ownerCount <= 1) {
          return fail('Cannot remove the last owner', 400)
        }
      }
      await db.membership.delete({ where: { id } })
      return ok({ id })
    }
    if (action === 'deleteCustomField') {
      await db.customField.delete({ where: { id } })
      return ok({ id })
    }
    if (action === 'deleteWorkspace') {
      const validation = deleteWorkspaceSchema.safeParse({ id: workspaceId })
      if (!validation.success) {
        return fail(validation.error.issues[0].message, 400)
      }
      await db.workspace.delete({ where: { id: workspaceId } })
      return ok({ id })
    }
    return fail('unknown action', 400)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return fail('Forbidden', 403)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Settings DELETE error:', error)
    return fail('Internal server error', 500)
  }
}
