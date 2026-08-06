import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, withRateLimit } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const pinnedOnly = url.searchParams.get('pinned') === '1'
    const notes = await db.note.findMany({
      where: { workspaceId, ...(pinnedOnly ? { pinned: true } : {}) },
      include: { author: true, lead: true, contact: true, deal: true, company: true },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    })
    return ok(serialize(notes))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Notes GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const note = await db.note.create({ data: { workspaceId, ...payload } })
    return ok(serialize(note))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Notes POST error:', error)
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
    const note = await db.note.update({ where: { id }, data: patch })
    return ok(serialize(note))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Notes PATCH error:', error)
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
    await db.note.delete({ where: { id } })
    return ok({ id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Notes DELETE error:', error)
    return fail('Internal server error', 500)
  }
}
