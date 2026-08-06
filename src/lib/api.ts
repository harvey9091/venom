import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  checkRateLimit,
  getRateLimitHeaders,
  sanitizeString,
  sanitizeHtml,
  addSecurityHeaders,
  validateContentType,
  checkCsrfToken,
} from '@/lib/security'

export const ok = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers)
  addSecurityHeaders(NextResponse.json({ ok: true, data }, { ...init, headers }))
  return NextResponse.json({ ok: true, data }, { ...init, headers })
}

export const fail = (error: string, status = 400, headers?: HeadersInit) => {
  const response = NextResponse.json({ ok: false, error }, { status, headers })
  addSecurityHeaders(response)
  return response
}

export function validateBody<T>(schema: { parse: (data: unknown) => T }): (data: unknown) => T {
  return (data: unknown) => schema.parse(data)
}

export async function getAuthUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const user = await db.user.findFirst({
    where: { email: session.user.email || undefined },
  })

  return user
}

export async function requireAuth() {
  const user = await getAuthUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function getWorkspaceId(req: Request): Promise<string | null> {
  const user = await getAuthUser()
  if (!user) return null

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })

  return membership?.workspaceId || null
}

export async function requireWorkspace(req: Request): Promise<string> {
  const user = await requireAuth()
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })

  if (!membership) {
    throw new Error('No workspace found')
  }

  return membership.workspaceId
}

export async function requireWorkspaceRole(req: Request, allowedRoles: string[]): Promise<{ userId: string; workspaceId: string; role: string }> {
  const user = await requireAuth()
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })

  if (!membership) {
    throw new Error('No workspace found')
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new Error('Forbidden')
  }

  return {
    userId: user.id,
    workspaceId: membership.workspaceId,
    role: membership.role,
  }
}

export function sanitizePayload<T extends Record<string, unknown>>(payload: T, stringFields: string[] = []): T {
  const sanitized = { ...payload } as Record<string, unknown>
  for (const key of stringFields) {
    if (sanitized[key] !== undefined && sanitized[key] !== null) {
      sanitized[key] = sanitizeString(String(sanitized[key]))
    }
  }
  return sanitized as T
}

export async function withRateLimit(req: Request, key?: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const rateKey = key || session?.user?.id || req.headers.get('x-forwarded-for') || 'anonymous'

  if (!checkRateLimit(rateKey)) {
    const headers = getRateLimitHeaders(rateKey)
    throw new RateLimitError(headers)
  }
}

export class RateLimitError extends Error {
  headers: Record<string, string>
  constructor(headers: Record<string, string>) {
    super('Rate limit exceeded')
    this.headers = headers
    this.name = 'RateLimitError'
  }
}

export async function validateRequest<T>(
  req: NextRequest,
  schema: { parse: (data: unknown) => T },
  options: { requireCsrf?: boolean; allowContentTypes?: string[] } = {}
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  const { requireCsrf = false, allowContentTypes = ['application/json'] } = options

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!validateContentType(req, allowContentTypes)) {
      return {
        success: false,
        response: fail('Unsupported content type', 415),
      }
    }

    if (requireCsrf && !checkCsrfToken(req)) {
      return {
        success: false,
        response: fail('CSRF token missing or invalid', 403),
      }
    }
  }

  try {
    const body = await req.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        response: fail(error.message, 422),
      }
    }
    return {
      success: false,
      response: fail('Invalid request body', 422),
    }
  }
}

export function sanitizeSearchQuery(query: string): string {
  return query.replace(/[<>]/g, '').trim().slice(0, 200)
}

export { sanitizeString } from '@/lib/security'

export function serialize<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T
}

export { db }
