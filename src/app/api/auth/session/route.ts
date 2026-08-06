import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ authenticated: false })
    }

    // Get or create user profile
    let user = await db.user.findFirst({
      where: {
        email: session.user.email || undefined,
      },
    })

    // If user doesn't exist, create profile
    if (!user && session.user.email) {
      user = await db.user.create({
        data: {
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          avatarUrl: session.user.user_metadata?.avatar_url || null,
          jobTitle: session.user.user_metadata?.job_title || null,
        },
      })
    }

    // Get workspace
    const membership = await db.membership.findFirst({
      where: { userId: user?.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    })

    const workspace = membership?.workspace || null

    return NextResponse.json({
      authenticated: true,
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      workspace: workspace ? { id: workspace.id, name: workspace.name, slug: workspace.slug } : null,
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ authenticated: false, error: 'Failed to get session' }, { status: 500 })
  }
}
