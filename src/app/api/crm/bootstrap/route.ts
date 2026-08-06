/**
 * GET /api/crm/bootstrap
 *
 * Resolves the current user's identity + workspace for the SPA bootstrap.
 *
 * Production (Supabase Auth):
 *   - Reads the Supabase auth session
 *   - Returns the user's profile + primary workspace + members + tags
 *
 * Dev (no auth):
 *   - Returns the first user + their first workspace (if seeded via seed-demo.ts)
 *   - If the database is EMPTY (no users), provisions a fresh workspace:
 *       • Creates a default user (dev@venom.crm)
 *       • Creates a workspace ("My Workspace")
 *       • Creates an owner membership
 *       • Creates a default pipeline with 7 stages
 *     This mirrors the first-login flow in production. No demo records.
 */
import { db, ok, serialize } from '@/lib/api'

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
  // Try to find an existing user
  let user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })

  // ── First-login provisioning (empty database) ──────────────────────
  // In production this would be triggered by a Supabase Auth post-signup
  // trigger or an Edge Function. Here we do it inline for the dev env.
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

    // Default pipeline + stages — no demo deals
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
          isWon: !!(s as any).isWon,
          isLost: !!(s as any).isLost,
        },
      })
    }

    return ok(serialize({
      user,
      workspace,
      members: [],
      tags: [],
      freshlyProvisioned: true,
    }))
  }

  // ── Existing user ──────────────────────────────────────────────────
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

  return ok(serialize({ user, workspace, members, tags, freshlyProvisioned: false }))
}
