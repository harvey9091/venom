import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    const supabase = createSupabaseServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findFirst({
      where: {
        email: session.user.email || undefined,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (action === 'create_workspace') {
      const { name, description } = body

      const slug = `ws-${Date.now().toString(36)}`

      const workspace = await db.workspace.create({
        data: {
          slug,
          name: name || 'My Workspace',
          description: description || 'Your Venom CRM workspace',
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

      // Create default pipeline
      const pipeline = await db.pipeline.create({
        data: {
          workspaceId: workspace.id,
          name: 'Sales Pipeline',
          isDefault: true,
          description: 'Standard sales pipeline',
        },
      })

      const stages = [
        { name: 'Lead In', color: '#94a3b8', probability: 10 },
        { name: 'Qualified', color: '#3b82f6', probability: 25 },
        { name: 'Demo', color: '#8b5cf6', probability: 50 },
        { name: 'Proposal', color: '#f59e0b', probability: 70 },
        { name: 'Negotiation', color: '#ec4899', probability: 85 },
        { name: 'Closed Won', color: '#10b981', probability: 100, isWon: true },
        { name: 'Closed Lost', color: '#ef4444', probability: 0, isLost: true },
      ]

      for (let i = 0; i < stages.length; i++) {
        const s = stages[i]
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
          workspace,
          pipeline,
        },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Provision error:', error)
    return NextResponse.json({ error: 'Failed to provision' }, { status: 500 })
  }
}
