import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth/session'

export async function middleware(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname

  // Auth pages that should redirect authenticated users
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth-error']
  const isAuthPage = authPages.some((page) => pathname.startsWith(page))

  // Protected paths
  const protectedPaths = ['/api/crm', '/dashboard', '/pipelines', '/leads', '/deals', '/tasks', '/notes', '/automations', '/settings']
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path) || pathname === '/dashboard')

  // Redirect authenticated users away from auth pages
  if (isAuthPage && session) {
    const redirect = request.nextUrl.searchParams.get('redirect') || '/dashboard'
    return NextResponse.redirect(new URL(redirect, request.url))
  }

  // Redirect unauthenticated users to login
  if (isProtectedPath && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For API routes, add user info to headers for downstream use
  if (pathname.startsWith('/api/crm') && session) {
    const user = await getCurrentUser()
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user?.id || '')
    requestHeaders.set('x-user-email', user?.email || '')

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
    response.headers.set('Access-Control-Max-Age', '86400')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:png|jpg|jpeg|svg|gif|webp)).*)',
  ],
}
