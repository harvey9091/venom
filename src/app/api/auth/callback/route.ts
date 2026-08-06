import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json({ authenticated: false, error: error.message }, { status: 401 })
    }

    if (!session) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
    })
  } catch (error) {
    console.error('Auth callback error:', error)
    const origin = request.nextUrl.origin
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }
}
