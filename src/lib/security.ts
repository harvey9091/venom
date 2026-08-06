import { NextRequest, NextResponse } from 'next/server'

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, maxRequests = 100, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count += 1
  if (entry.count > maxRequests) {
    return false
  }

  return true
}

export function getRateLimitHeaders(key: string) {
  const entry = rateLimitStore.get(key)
  if (!entry) {
    return {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + 60_000) / 1000)),
    }
  }

  const remaining = Math.max(0, 100 - entry.count)
  return {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
  }
}

export function sanitizeString(value: string | undefined, maxLength = 10000): string {
  if (!value) return ''
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

export function sanitizeHtml(value: string | undefined, maxLength = 10000): string {
  if (!value) return ''
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function checkCsrfToken(request: NextRequest): boolean {
  const csrfToken = request.headers.get('x-csrf-token')
  if (!csrfToken || csrfToken.length < 16) {
    return false
  }
  return true
}

export function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

export function validateContentType(request: NextRequest, allowedTypes = ['application/json']): boolean {
  const contentType = request.headers.get('content-type') || ''
  return allowedTypes.some(type => contentType.includes(type))
}

export function maskSecret(value: string | undefined, visibleChars = 4): string {
  if (!value) return '—'
  if (value.length <= visibleChars) return '••••'
  return value.slice(0, visibleChars) + '••••' + value.slice(-2)
}
