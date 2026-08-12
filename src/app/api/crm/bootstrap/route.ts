import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'

const DEFAULT_PIPELINE_STAGES = [
  { name: 'Lead In',     color: '#94a3b8', probability: 10 },
  { name: 'Qualified',   color: '#3b82f6', probability: 25 },
  { name: 'Demo',        color: '#8b5cf6', probability: 50 },
  { name: 'Proposal',    color: '#f59e0b', probability: 70 },
  { name: 'Negotiation', color: '#ec4899', probability: 85 },
  { name: 'Closed Won',  color: '#10b981', probability: 100, isWon: true },
  { name: 'Closed Lost', color: '#ef4444', probability: 0, isLost: true },
]

type BootstrapErrorCode =
  | 'AUTH_REQUIRED'
  | 'USER_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  | 'DATABASE_CONNECTION_ERROR'
  | 'DATABASE_SCHEMA_ERROR'
  | 'DATABASE_PERMISSION_ERROR'
  | 'DATABASE_CONSTRAINT_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN_BOOTSTRAP_ERROR'

function classifyError(error: unknown): { code: BootstrapErrorCode; message: string; status: number } {
  const err = error instanceof Error ? error : new Error(String(error))
  const msg = err.message.toLowerCase()
  const cause = err.cause instanceof Error ? err.cause.message.toLowerCase() : ''

  if (msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('invalid token') || msg.includes('auth')) {
    return { code: 'AUTH_REQUIRED', message: 'Authentication required', status: 401 }
  }
  if (msg.includes('p1001') || msg.includes('can\'t reach database') || msg.includes('p1000') || msg.includes('p1002') || msg.includes('p1003') || msg.includes('p1004') || msg.includes('p1005') || msg.includes('p1006') || msg.includes('p1007') || msg.includes('p1008') || msg.includes('p1009') || msg.includes('connect') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('econnreset') || msg.includes('socket hang up') || cause.includes('connect') || cause.includes('timeout') || cause.includes('econnrefused')) {
    return { code: 'DATABASE_CONNECTION_ERROR', message: 'Database connection failed', status: 503 }
  }
  if (msg.includes('environment variable') || msg.includes('env var') || msg.includes('missing') && msg.includes('database')) {
    return { code: 'CONFIGURATION_ERROR', message: 'Server configuration error', status: 500 }
  }
  if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('column') || msg.includes('schema') || msg.includes('table')) {
    return { code: 'DATABASE_SCHEMA_ERROR', message: 'Database schema error', status: 500 }
  }
  if (msg.includes('permission') || msg.includes('rls') || msg.includes('policy') || msg.includes('access denied')) {
    return { code: 'DATABASE_PERMISSION_ERROR', message: 'Database permission error', status: 500 }
  }
  if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('constraint') || msg.includes('violation')) {
    return { code: 'DATABASE_CONSTRAINT_ERROR', message: 'Database constraint error', status: 409 }
  }
  if (msg.includes('missing') || msg.includes('env') || msg.includes('config')) {
    return { code: 'CONFIGURATION_ERROR', message: 'Server configuration error', status: 500 }
  }

  return { code: 'UNKNOWN_BOOTSTRAP_ERROR', message: 'Failed to bootstrap workspace', status: 500 }
}

async function getSupabaseUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const supabase = await createSupabaseServerClient()
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return user
      }
    } catch {
      // fall through to cookie-based auth
    }
  }

  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    return session.user
  }

  return null
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    console.error('[CRM Bootstrap] DATABASE_URL environment variable is not set')
    return NextResponse.json(
      { ok: false, code: 'CONFIGURATION_ERROR', error: 'Server configuration error: DATABASE_URL is missing' },
      { status: 500 }
    )
  }

  try {
    const supabaseUser = await getSupabaseUserFromRequest(request)

    if (!supabaseUser) {
      return NextResponse.json(
        { ok: false, code: 'AUTH_REQUIRED', error: 'Authentication required' },
        { status: 401 }
      )
    }

    let user = await db.user.findFirst({
      where: { email: supabaseUser.email || undefined },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email: supabaseUser.email || '',
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
          jobTitle: supabaseUser.user_metadata?.job_title || null,
        },
      })
    }

    const membership = await db.membership.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    })

    if (!membership) {
      const workspace = await db.workspace.create({
        data: {
          slug: `ws-${Date.now().toString(36)}`,
          name: 'My Workspace',
          description: 'Your Venom CRM workspace',
          accentColor: '#d4a373',
          plan: 'free',
        },
      })

      await db.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: 'owner',
        },
      })

      const pipeline = await db.pipeline.create({
        data: {
          workspaceId: workspace.id,
          name: 'Sales Pipeline',
          isDefault: true,
          description: 'Standard sales pipeline',
        },
      })

      for (let i = 0; i < DEFAULT_PIPELINE_STAGES.length; i++) {
        const s = DEFAULT_PIPELINE_STAGES[i]
        await db.stage.create({
          data: {
            pipelineId: pipeline.id,
            name: s.name,
            color: s.color,
            probability: s.probability,
            order: i,
            isWon: !!s.isWon,
            isLost: !!s.isLost,
          },
        })
      }

      return NextResponse.json({
        ok: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
          members: [],
          tags: [],
          freshlyProvisioned: true,
        },
      })
    }

    const workspace = membership.workspace
    const workspaceId = workspace.id

    const [members, tags, memberships] = await Promise.all([
      db.membership.findMany({ where: { workspaceId }, include: { user: true } }),
      db.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } }),
      db.membership.findMany({
        where: { userId: user.id },
        include: { workspace: true },
        orderBy: { joinedAt: 'asc' },
      }),
    ])

    const serializedMemberships = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      workspaceId: m.workspaceId,
      role: m.role,
      joinedAt: m.joinedAt,
      workspace: m.workspace ? {
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        plan: m.workspace.plan,
      } : null,
    }))

    return NextResponse.json({
      ok: true,
      data: { user, workspace, members, tags, memberships: serializedMemberships, freshlyProvisioned: false },
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    const prismaError = err as { code?: string; meta?: unknown; cause?: unknown }
    console.error('[CRM Bootstrap] Database connection failed')
    console.error('[CRM Bootstrap] Error name:', err.name)
    console.error('[CRM Bootstrap] Error message:', err.message)
    if (prismaError.code) {
      console.error('[CRM Bootstrap] Prisma error code:', prismaError.code)
    }
    if (prismaError.meta) {
      console.error('[CRM Bootstrap] Prisma error meta:', JSON.stringify(prismaError.meta))
    }
    if (prismaError.cause) {
      console.error('[CRM Bootstrap] Error cause:', prismaError.cause)
    }
    const { code, message, status } = classifyError(error)
    return NextResponse.json(
      { ok: false, code, error: message },
      { status }
    )
  }
}
