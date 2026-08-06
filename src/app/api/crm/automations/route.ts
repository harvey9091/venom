import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, withRateLimit } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const q = sanitizeSearchQuery(url.searchParams.get('q') || '')
    const automations = await db.automation.findMany({
      where: {
        workspaceId,
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(serialize(automations))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Automations GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const automation = await db.automation.create({ data: { workspaceId, ...payload } })
    return ok(serialize(automation))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Automations POST error:', error)
    return fail('Internal server error', 500)
  }
}

export async function PATCH(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { id, ...patch } = body
    if (!id) return fail('id required', 400)
    const automation = await db.automation.update({ where: { id }, data: patch })
    return ok(serialize(automation))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Automations PATCH error:', error)
    return fail('Internal server error', 500)
  }
}

export async function DELETE(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { id } = body
    if (!id) return fail('id required', 400)
    await db.automation.delete({ where: { id } })
    return ok({ id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Automations DELETE error:', error)
    return fail('Internal server error', 500)
  }
}
