import { db, ok, fail, requireWorkspace, serialize, sanitizeSearchQuery, withRateLimit } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const url = new URL(req.url)
    const q = sanitizeSearchQuery(url.searchParams.get('q') || '')
    const tags = await db.tag.findMany({
      where: {
        workspaceId,
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { name: 'asc' },
    })
    return ok(serialize(tags))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Tags GET error:', error)
    return fail('Internal server error', 500)
  }
}

export async function POST(req: Request) {
  try {
    await withRateLimit(req)
    const workspaceId = await requireWorkspace(req)
    const body = await req.json()
    const { workspaceId: _ws, ...payload } = body
    const tag = await db.tag.create({ data: { workspaceId, ...payload } })
    return ok(serialize(tag))
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Tags POST error:', error)
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
    await db.tag.delete({ where: { id } })
    return ok({ id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message === 'Rate limit exceeded') {
      return fail('Rate limit exceeded', 429, { 'Retry-After': '60' })
    }
    console.error('Tags DELETE error:', error)
    return fail('Internal server error', 500)
  }
}
