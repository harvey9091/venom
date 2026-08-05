/**
 * Venom CRM — Seed Script
 * Populates a single workspace ("Venom CRM") with users, companies, contacts,
 * leads, deals, pipeline, tasks, notes, automations, notifications.
 *
 * Run with:  bun run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'

const db = new PrismaClient()

const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000)
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400_000)

async function main() {
  // --- Wipe (dev only) ---
  await db.entityTag.deleteMany()
  await db.tag.deleteMany()
  await db.comment.deleteMany()
  await db.taskWatcher.deleteMany()
  await db.task.deleteMany()
  await db.meeting.deleteMany()
  await db.calendarEvent.deleteMany()
  await db.note.deleteMany()
  await db.file.deleteMany()
  await db.activity.deleteMany()
  await db.notification.deleteMany()
  await db.auditLog.deleteMany()
  await db.automationLog.deleteMany()
  await db.automation.deleteMany()
  await db.apiKey.deleteMany()
  await db.customField.deleteMany()
  await db.deal.deleteMany()
  await db.stage.deleteMany()
  await db.pipeline.deleteMany()
  await db.lead.deleteMany()
  await db.contact.deleteMany()
  await db.company.deleteMany()
  await db.membership.deleteMany()
  await db.session.deleteMany()
  await db.workspace.deleteMany()
  await db.user.deleteMany()

  // --- Users ---
  const users = await Promise.all([
    db.user.create({ data: { email: 'ava@venom.crm', name: 'Ava Chen', avatarUrl: 'https://i.pravatar.cc/100?img=47', jobTitle: 'Head of Sales' } }),
    db.user.create({ data: { email: 'noah@venom.crm', name: 'Noah Patel', avatarUrl: 'https://i.pravatar.cc/100?img=12', jobTitle: 'Account Executive' } }),
    db.user.create({ data: { email: 'mia@venom.crm', name: 'Mia Rossi', avatarUrl: 'https://i.pravatar.cc/100?img=32', jobTitle: 'SDR' } }),
    db.user.create({ data: { email: 'liam@venom.crm', name: 'Liam Park', avatarUrl: 'https://i.pravatar.cc/100?img=15', jobTitle: 'CS Manager' } }),
    db.user.create({ data: { email: 'emma@venom.crm', name: 'Emma Brooks', avatarUrl: 'https://i.pravatar.cc/100?img=45', jobTitle: 'Founder' } }),
  ])
  const [ava, noah, mia, liam, emma] = users

  // --- Workspace ---
  const ws = await db.workspace.create({
    data: {
      slug: 'venom',
      name: 'Venom CRM',
      description: 'Premium sales workspace for Venom CRM',
      accentColor: '#d4a373',
      plan: 'pro',
    },
  })

  // --- Memberships ---
  await db.membership.createMany({
    data: [
      { userId: emma.id, workspaceId: ws.id, role: 'owner' },
      { userId: ava.id, workspaceId: ws.id, role: 'admin' },
      { userId: noah.id, workspaceId: ws.id, role: 'member' },
      { userId: mia.id, workspaceId: ws.id, role: 'member' },
      { userId: liam.id, workspaceId: ws.id, role: 'member' },
    ],
  })

  // --- Pipeline + Stages ---
  const pipeline = await db.pipeline.create({
    data: { workspaceId: ws.id, name: 'Sales Pipeline', isDefault: true, description: 'Standard B2B SaaS sales flow' },
  })
  const stageDefs = [
    { name: 'Lead In',    color: '#94a3b8', probability: 10 },
    { name: 'Qualified',  color: '#3b82f6', probability: 25 },
    { name: 'Demo',       color: '#8b5cf6', probability: 50 },
    { name: 'Proposal',   color: '#f59e0b', probability: 70 },
    { name: 'Negotiation', color: '#ec4899', probability: 85 },
    { name: 'Closed Won', color: '#10b981', probability: 100, isWon: true },
    { name: 'Closed Lost', color: '#ef4444', probability: 0, isLost: true },
  ]
  const stages = await Promise.all(
    stageDefs.map((s, i) => db.stage.create({ data: { pipelineId: pipeline.id, name: s.name, color: s.color, probability: s.probability, order: i, isWon: !!s.isWon, isLost: !!s.isLost } }))
  )

  // --- Companies ---
  const companySeeds = [
    { name: 'Stripe',       domain: 'stripe.com',     industry: 'Fintech',    size: '1000+', revenue: 99_60_00_000 },
    { name: 'Linear',       domain: 'linear.app',     industry: 'SaaS',       size: '50-200', revenue: 37_35_00_000 },
    { name: 'Notion',       domain: 'notion.so',      industry: 'SaaS',       size: '200+',  revenue: 66_40_00_000 },
    { name: 'Vercel',       domain: 'vercel.com',     industry: 'DevTools',   size: '200+',  revenue: 81_34_00_000 },
    { name: 'Figma',        domain: 'figma.com',      industry: 'Design',     size: '500+',  revenue: 1_24_50_00_000 },
    { name: 'Loom',         domain: 'loom.com',       industry: 'SaaS',       size: '100+',  revenue: 26_56_00_000 },
    { name: 'Cal.com',      domain: 'cal.com',        industry: 'SaaS',       size: '50-200', revenue: 16_60_00_000 },
    { name: 'Retool',       domain: 'retool.com',     industry: 'DevTools',   size: '200+',  revenue: 62_25_00_000 },
  ]
  const companies = await Promise.all(
    companySeeds.map((c) => db.company.create({
      data: { ...c, workspaceId: ws.id, website: `https://${c.domain}`, country: 'United States', city: 'San Francisco', status: 'active' }
    }))
  )

  // --- Contacts ---
  const firstNames = ['Alex', 'Jordan', 'Casey', 'Riley', 'Sam', 'Taylor', 'Morgan', 'Jamie', 'Drew', 'Cameron', 'Skyler', 'Reese']
  const lastNames = ['Kim', 'Nguyen', 'Garcia', 'Muller', 'Singh', 'Okafor', 'Silva', 'Tanaka', 'Ivanov', 'Cohen', 'Andersson', 'Reyes']
  const jobTitles = ['VP Engineering', 'Head of Product', 'CTO', 'CEO', 'Director of Ops', 'Engineering Manager', 'Head of Design', 'CFO', 'COO', 'VP Sales']
  const contacts: any[] = []
  for (let i = 0; i < 40; i++) {
    const company = companies[i % companies.length]
    const fn = firstNames[i % firstNames.length]
    const ln = lastNames[(i * 3) % lastNames.length]
    const c = await db.contact.create({
      data: {
        workspaceId: ws.id,
        companyId: company.id,
        firstName: fn,
        lastName: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${company.domain}`,
        phone: `+1 415 555 ${(1000 + i).toString().padStart(4, '0')}`,
        jobTitle: jobTitles[i % jobTitles.length],
        status: 'subscribed',
      },
    })
    contacts.push(c)
  }

  // --- Leads ---
  const leadSources = ['website', 'referral', 'ads', 'cold-outreach', 'event', 'other']
  const leadStatuses = ['new', 'contacted', 'qualified', 'unqualified', 'converted']
  const owners = [noah, mia, ava]
  const leads: any[] = []
  for (let i = 0; i < 60; i++) {
    const contact = contacts[i % contacts.length]
    const company = companies[i % companies.length]
    const status = leadStatuses[i % leadStatuses.length]
    const owner = owners[i % owners.length]
    const score = Math.min(100, Math.max(0, Math.round((i * 7) % 100)))
    const lead = await db.lead.create({
      data: {
        workspaceId: ws.id,
        contactId: contact.id,
        companyId: company.id,
        ownerId: owner.id,
        fullName: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        phone: contact.phone,
        source: leadSources[i % leadSources.length],
        status,
        score,
        estimatedValue: 4_15_000 + (i * 1_24_500) % 74_70_000,
        lastActivityAt: daysAgo(i % 14),
        createdAt: daysAgo(30 + (i % 60)),
      },
    })
    leads.push(lead)
  }

  // --- Deals ---
  const dealTitles = [
    'Annual Platform License', 'Enterprise Renewal', 'Pilot Expansion', 'Multi-seat Upgrade',
    'Starter Plan', 'Pro Tier Migration', 'Custom Integration', 'API Quota Increase',
    'Premium Support Add-on', 'Teams Bundle', 'Security Audit Package', 'Onboarding Services'
  ]
  const deals: any[] = []
  for (let i = 0; i < 50; i++) {
    const contact = contacts[i % contacts.length]
    const company = companies[i % companies.length]
    const stage = stages[i % stages.length]
    const owner = owners[i % owners.length]
    const amount = 6_64_000 + (i * 2_90_500) % 99_60_000
    const deal = await db.deal.create({
      data: {
        workspaceId: ws.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        contactId: contact.id,
        companyId: company.id,
        ownerId: owner.id,
        title: `${dealTitles[i % dealTitles.length]} — ${company.name}`,
        amount,
        currency: 'USD',
        probability: stage.probability,
        expectedClose: daysFromNow((i % 30) - 10),
        closedAt: stage.isWon || stage.isLost ? daysAgo(i % 20) : null,
        closeReason: stage.isWon ? 'won' : stage.isLost ? 'lost' : null,
        createdAt: daysAgo(40 + (i % 30)),
      },
    })
    deals.push(deal)
  }

  // --- Tasks ---
  const taskTitles = [
    'Send follow-up email', 'Prepare demo deck', 'Schedule kickoff call', 'Update CRM fields',
    'Review contract', 'Confirm next steps', 'Share pricing sheet', 'Loop in solutions engineer',
    'Send proposal v2', 'Internal sync', 'Update forecast', 'Create onboarding plan',
    'Quarterly check-in', 'Renewal outreach', 'Champion letter', 'Mutual action plan'
  ]
  const priorities = ['low', 'medium', 'high', 'urgent']
  const taskStatuses = ['todo', 'in_progress', 'done', 'canceled']
  for (let i = 0; i < 30; i++) {
    const deal = deals[i % deals.length]
    const owner = owners[i % owners.length]
    const status = taskStatuses[i % taskStatuses.length]
    const task = await db.task.create({
      data: {
        workspaceId: ws.id,
        dealId: deal.id,
        title: taskTitles[i % taskTitles.length],
        description: `Auto-generated task for deal "${deal.title}". Use the linked deal context for talking points.`,
        status,
        priority: priorities[i % priorities.length],
        ownerId: owner.id,
        assigneeId: owner.id,
        creatorId: emma.id,
        dueDate: daysFromNow((i % 14) - 5),
        startDate: daysAgo(i % 5),
        recurrence: i % 5 === 0 ? 'weekly' : null,
        order: i,
      },
    })
    const subtaskCount = 1 + (i % 3)
    for (let j = 0; j < subtaskCount; j++) {
      await db.task.create({
        data: {
          workspaceId: ws.id,
          parentTaskId: task.id,
          title: `Subtask ${j + 1}: ${['Research', 'Draft', 'Review'][j % 3]}`,
          status: j === 0 ? 'done' : 'todo',
          priority: 'medium',
          ownerId: owner.id,
          assigneeId: owner.id,
          creatorId: emma.id,
          order: j,
        }
      })
    }
    if (i % 4 === 0) {
      await db.comment.create({ data: { taskId: task.id, authorId: emma.id, body: 'Heads up — legal review needed before sending.' } })
      await db.comment.create({ data: { taskId: task.id, authorId: ava.id, body: 'Tagging @noah for visibility.' } })
    }
  }

  // --- Notes ---
  for (let i = 0; i < 25; i++) {
    const lead = leads[i % leads.length]
    await db.note.create({
      data: {
        workspaceId: ws.id,
        authorId: owners[i % owners.length].id,
        leadId: lead.id,
        contactId: lead.contactId,
        dealId: deals[i % deals.length].id,
        title: `Discovery note — ${lead.fullName}`,
        body: `Had an initial conversation with ${lead.fullName}. Key pain points:\n• Legacy system latency\n• No native API integrations\n• Reporting gaps for leadership\n\nNext step: schedule technical deep-dive.`,
        pinned: i % 6 === 0,
      }
    })
  }

  // --- Calendar events ---
  const eventTitles = ['Pipeline review', 'Customer demo', 'Sales standup', 'Renewal call', 'Forecast planning', 'Quarterly business review']
  for (let i = 0; i < 20; i++) {
    const start = daysFromNow((i % 14) - 3)
    start.setHours(9 + (i % 8), 0, 0, 0)
    const end = new Date(start.getTime() + (30 + (i % 4) * 15) * 60_000)
    const event = await db.calendarEvent.create({
      data: {
        workspaceId: ws.id,
        title: eventTitles[i % eventTitles.length] + (i % 2 === 0 ? ' — Venom' : ''),
        type: i % 3 === 0 ? 'call' : 'meeting',
        startAt: start,
        endAt: end,
        location: i % 2 === 0 ? 'Zoom' : 'Google Meet',
        meetingLink: 'https://meet.example.com/abc-' + i,
      }
    })
    await db.meeting.create({
      data: {
        eventId: event.id,
        contactId: contacts[i % contacts.length].id,
        hostId: owners[i % owners.length].id,
        outcome: start < now ? 'completed' : 'scheduled',
      }
    })
  }

  // --- Tags ---
  const tagDefs = [
    { name: 'enterprise', color: '#6366f1' },
    { name: 'smb', color: '#10b981' },
    { name: 'hot-lead', color: '#ef4444' },
    { name: 'champion', color: '#f59e0b' },
    { name: 'renewal', color: '#3b82f6' },
    { name: 'expand', color: '#8b5cf6' },
    { name: 'at-risk', color: '#ec4899' },
  ]
  const tags = await Promise.all(tagDefs.map(t => db.tag.create({ data: { workspaceId: ws.id, ...t } })))
  for (let i = 0; i < leads.length; i += 3) {
    const tag = tags[i % tags.length]
    await db.entityTag.create({ data: { workspaceId: ws.id, tagId: tag.id, entityType: 'lead', entityId: leads[i].id } })
  }

  // --- Activities ---
  const activityTypes = [
    { type: 'created', summary: 'created lead' },
    { type: 'status_changed', summary: 'moved to' },
    { type: 'note_added', summary: 'added note on' },
    { type: 'file_uploaded', summary: 'uploaded file to' },
    { type: 'email_sent', summary: 'emailed' },
    { type: 'call_logged', summary: 'logged call with' },
  ]
  for (let i = 0; i < 40; i++) {
    const lead = leads[i % leads.length]
    const a = activityTypes[i % activityTypes.length]
    await db.activity.create({
      data: {
        workspaceId: ws.id,
        actorId: owners[i % owners.length].id,
        leadId: lead.id,
        type: a.type,
        summary: `${a.summary} ${lead.fullName}`,
        createdAt: daysAgo(i % 20),
      }
    })
  }

  // --- Notifications ---
  for (let i = 0; i < 12; i++) {
    await db.notification.create({
      data: {
        workspaceId: ws.id,
        userId: emma.id,
        type: ['mention', 'assignment', 'automation', 'system'][i % 4],
        title: ['You were mentioned', 'New task assigned', 'Automation ran', 'Workspace updated'][i % 4],
        body: ['Ava mentioned you in Deal review', 'Noah assigned a task to you', 'Lead scoring automation completed', 'Theme preferences saved'][i % 4],
        read: i % 3 === 0,
        createdAt: daysAgo(i % 7),
      }
    })
  }

  // --- Automations ---
  const sampleGraph = JSON.stringify({
    nodes: [
      { id: 't1', type: 'trigger', data: { triggerType: 'lead_created' }, position: { x: 40, y: 120 } },
      { id: 'c1', type: 'condition', data: { field: 'score', op: 'greater_than', value: 70 }, position: { x: 320, y: 120 } },
      { id: 'a1', type: 'action', data: { actionType: 'assign_user', target: 'noah' }, position: { x: 620, y: 60 } },
      { id: 'a2', type: 'action', data: { actionType: 'add_tag', tag: 'hot-lead' }, position: { x: 620, y: 180 } },
      { id: 'a3', type: 'action', data: { actionType: 'send_notification' }, position: { x: 900, y: 120 } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1' },
      { id: 'e2', source: 'c1', target: 'a1', label: 'true' },
      { id: 'e3', source: 'c1', target: 'a2', label: 'true' },
      { id: 'e4', source: 'a1', target: 'a3' },
    ],
  })
  await db.automation.createMany({
    data: [
      { workspaceId: ws.id, name: 'Hot lead routing', description: 'Auto-assign high-score leads to Noah', enabled: true, triggerType: 'lead_created', graph: sampleGraph, runsCount: 142, lastRunAt: daysAgo(1) },
      { workspaceId: ws.id, name: 'Welcome email', description: 'Send welcome note when contact is added', enabled: true, triggerType: 'contact_added', graph: sampleGraph, runsCount: 89, lastRunAt: daysAgo(2) },
      { workspaceId: ws.id, name: 'Won deal celebration', description: 'Notify channel when deal is won', enabled: false, triggerType: 'deal_won', graph: sampleGraph, runsCount: 23, lastRunAt: daysAgo(5) },
      { workspaceId: ws.id, name: 'Stale lead nudge', description: 'Create follow-up task after 14d inactivity', enabled: true, triggerType: 'lead_updated', graph: sampleGraph, runsCount: 311, lastRunAt: daysAgo(0) },
    ],
  })

  // --- Custom fields ---
  await db.customField.createMany({
    data: [
      { workspaceId: ws.id, entityType: 'lead', name: 'Budget', key: 'budget', type: 'number' },
      { workspaceId: ws.id, entityType: 'lead', name: 'Decision Timeline', key: 'decision_timeline', type: 'select', options: JSON.stringify(['< 1 month', '1-3 months', '3-6 months', '6+ months']) },
      { workspaceId: ws.id, entityType: 'deal', name: 'Competitors', key: 'competitors', type: 'text' },
      { workspaceId: ws.id, entityType: 'company', name: 'Technologies', key: 'technologies', type: 'multiselect', options: JSON.stringify(['AWS', 'GCP', 'Azure', 'Vercel', 'Cloudflare']) },
    ],
  })

  // --- Audit logs ---
  for (let i = 0; i < 15; i++) {
    await db.auditLog.create({
      data: {
        workspaceId: ws.id,
        actorId: owners[i % owners.length].id,
        action: ['create', 'update', 'delete', 'invite', 'export'][i % 5],
        entityType: ['lead', 'deal', 'contact', 'workspace', 'automation'][i % 5],
        entityId: leads[i % leads.length].id,
        meta: JSON.stringify({ ip: '203.0.113.42', userAgent: 'Chrome 130' }),
        createdAt: daysAgo(i % 14),
      }
    })
  }

  // --- API keys ---
  const apiKey = 'pk_live_' + randomBytes(24).toString('hex')
  await db.apiKey.create({
    data: {
      workspaceId: ws.id,
      creatorId: emma.id,
      name: 'Production Webhook',
      prefix: apiKey.slice(0, 12),
      hashedKey: createHash('sha256').update(apiKey).digest('hex'),
      lastUsedAt: daysAgo(1),
    }
  })

  // --- Files (mocked URLs) ---
  for (let i = 0; i < 8; i++) {
    await db.file.create({
      data: {
        workspaceId: ws.id,
        uploaderId: owners[i % owners.length].id,
        leadId: leads[i % leads.length].id,
        name: `Proposal-${companies[i % companies.length].name}-v${1 + (i % 3)}.pdf`,
        mimeType: 'application/pdf',
        size: 480_000 + (i * 32_000),
        url: `https://files.venom.crm/proposal-${i}.pdf`,
        version: 1 + (i % 3),
      }
    })
  }

  console.log(`OK Seeded workspace "${ws.name}" (${ws.slug})`)
  console.log(`  Users: ${users.length}, Companies: ${companies.length}, Contacts: ${contacts.length}`)
  console.log(`  Leads: ${leads.length}, Deals: ${deals.length}, Stages: ${stages.length}`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
