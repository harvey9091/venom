import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
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

export async function GET() {
  try {
    const supabase = createSupabaseServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      if (process.env.NODE_ENV === 'development') {
        let user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })

        if (!user) {
          user = await db.user.create({
            data: {
              email: 'dev@venom.crm',
              name: 'New User',
              jobTitle: 'Owner',
            },
          })

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

        const membership = await db.membership.findFirst({
          where: { userId: user.id },
          include: { workspace: true },
          orderBy: { joinedAt: 'asc' },
        })
        const workspace = membership?.workspace || null
        const workspaceId = workspace?.id

        const [members, tags] = workspaceId
          ? await Promise.all([
              db.membership.findMany({ where: { workspaceId }, include: { user: true } }),
              db.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } }),
            ])
          : [[], []]

        return NextResponse.json({
          ok: true,
          data: { user, workspace, members, tags, freshlyProvisioned: false },
        })
      }

      return NextResponse.json({ ok: true, data: null })
    }

    const user = await db.user.findFirst({
      where: { email: session.user.email || undefined },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          avatarUrl: session.user.user_metadata?.avatar_url || null,
          jobTitle: session.user.user_metadata?.job_title || null,
        },
      })
    }

    let membership = await db.membership.findFirst({
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

      membership = await db.membership.create({
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

    const [members, tags] = await Promise.all([
      db.membership.findMany({ where: { workspaceId }, include: { user: true } }),
      db.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } }),
    ])

    return NextResponse.json({
      ok: true,
      data: { user, workspace, members, tags, freshlyProvisioned: false },
    })
  } catch (error) {
    console.error('Bootstrap error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to bootstrap' },
      { status: 500 }
    )
  }
}
