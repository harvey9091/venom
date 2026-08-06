import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const [deals, leads, contacts, tasks, activities, pipelines] = await Promise.all([
      db.deal.findMany({
        where: { workspaceId },
        include: { stage: true, owner: true, company: true },
      }),
      db.lead.findMany({
        where: { workspaceId },
        include: { owner: true, contact: true, company: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.contact.findMany({ where: { workspaceId }, include: { company: true } }),
      db.task.findMany({
        where: { workspaceId, parentTaskId: null },
        include: { assignee: true, owner: true, deal: true },
        orderBy: { dueDate: 'asc' },
        take: 8,
      }),
      db.activity.findMany({
        where: { workspaceId },
        include: { actor: true, lead: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      db.pipeline.findMany({
        where: { workspaceId },
        include: { stages: { orderBy: { order: 'asc' } }, deals: { include: { stage: true, owner: true, company: true } } },
      }),
    ])

    const wonDeals = deals.filter((d) => d.stage?.isWon)
    const lostDeals = deals.filter((d) => d.stage?.isLost)
    const openDeals = deals.filter((d) => !d.stage?.isWon && !d.stage?.isLost)
    const revenue = wonDeals.reduce((s, d) => s + d.amount, 0)
    const pipelineValue = openDeals.reduce((s, d) => s + d.amount, 0)
    const weightedPipeline = openDeals.reduce((s, d) => s + (d.amount * (d.stage?.probability ?? 0)) / 100, 0)

    const now = new Date()
    const months: { label: string; revenue: number; pipeline: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthWon = wonDeals.filter((d2) => d2.closedAt && d2.closedAt >= d && d2.closedAt < next)
      const monthOpen = openDeals.filter((d2) => d2.createdAt >= d && d2.createdAt < next)
      months.push({
        label: d.toLocaleString('en-US', { month: 'short' }),
        revenue: monthWon.reduce((s, x) => s + x.amount, 0),
        pipeline: monthOpen.reduce((s, x) => s + x.amount, 0),
      })
    }

    const sourceMap: Record<string, number> = {}
    for (const l of leads) {
      const k = l.source || 'unknown'
      sourceMap[k] = (sourceMap[k] || 0) + 1
    }
    const leadSources = Object.entries(sourceMap).map(([name, value]) => ({ name, value }))

    const conversionRate = leads.length > 0
      ? Math.round((leads.filter((l) => l.status === 'converted').length / leads.length) * 100)
      : 0

    const upcomingTasks = tasks.slice(0, 6)
    const recentLeads = leads.slice(0, 6)
    const wonRate = deals.length > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length || 1)) * 100) : 0

    return ok({
      metrics: {
        revenue,
        pipelineValue,
        weightedPipeline,
        dealCount: deals.length,
        wonDeals: wonDeals.length,
        lostDeals: lostDeals.length,
        openDeals: openDeals.length,
        leadCount: leads.length,
        contactCount: contacts.length,
        avgDealSize: deals.length ? Math.round(revenue / (wonDeals.length || 1)) : 0,
        conversionRate,
        wonRate,
      },
      monthly: months,
      leadSources,
      pipelines: pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        stages: p.stages.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          probability: s.probability,
          dealCount: p.deals.filter((d) => d.stageId === s.id).length,
          value: p.deals.filter((d) => d.stageId === s.id).reduce((sum, d) => sum + d.amount, 0),
        })),
      })),
      upcomingTasks,
      recentLeads,
      activities,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Dashboard GET error:', error)
    return fail('Internal server error', 500)
  }
}
