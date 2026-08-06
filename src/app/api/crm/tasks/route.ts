import { db, ok, fail, requireWorkspace, serialize, withRateLimit, sanitizeSearchQuery, sanitizeString } from '@/lib/api'

export async function GET(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const tasks = await db.task.findMany({
      where: {
        workspaceId,
        parentTaskId: null,
        ...(status ? { status: sanitizeString(status, 50) } : {}),
      },
      include: {
        assignee: true,
        owner: true,
        creator: true,
        deal: true,
        subtasks: { orderBy: { order: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { order: 'asc' },
    })
    return ok(serialize(tasks))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Tasks GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const task = await db.task.create({ data: { workspaceId, ...payload } })
    return ok(serialize(task))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Tasks POST error:', error)
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
    const task = await db.task.update({ where: { id }, data: patch })
    return ok(serialize(task))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Tasks PATCH error:', error)
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
    await db.task.delete({ where: { id } })
    return ok({ id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Tasks DELETE error:', error)
    return fail('Internal server error', 500)
  }
}
