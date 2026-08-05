'use client'

/**
 * Pulse CRM — Dashboard view
 * Premium Linear/Vercel/Stripe-inspired landing page.
 * Renders KPI strip, revenue chart, lead sources donut, pipeline health,
 * upcoming tasks, recent leads, activity feed, and quick actions.
 */

import { useDashboard } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  ScoreBar,
  StatusDot,
  PriorityPill,
  money,
  relTime,
  EmptyState,
} from '@/components/crm/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, type Variants } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  KanbanSquare,
  Upload,
  ListTodo,
  Sparkles,
  ChevronRight,
  Activity as ActivityIcon,
} from 'lucide-react'
import type { Task, Lead, Activity } from '@/lib/types'

// ---------------------------------------------------------------
// Types — match the shape returned by useDashboard()
// ---------------------------------------------------------------
interface DashboardMetrics {
  revenue: number
  pipelineValue: number
  weightedPipeline: number
  dealCount: number
  wonDeals: number
  lostDeals: number
  openDeals: number
  leadCount: number
  contactCount: number
  avgDealSize: number
  conversionRate: number
  wonRate: number
}

interface MonthlyPoint {
  label: string
  revenue: number
  pipeline: number
}

interface LeadSource {
  name: string
  value: number
}

interface PipelineStage {
  id: string
  name: string
  color: string
  probability: number
  dealCount: number
  value: number
}

interface PipelineSummary {
  id: string
  name: string
  stages: PipelineStage[]
}

interface DashboardData {
  metrics: DashboardMetrics
  monthly: MonthlyPoint[]
  leadSources: LeadSource[]
  pipelines: PipelineSummary[]
  upcomingTasks: Task[]
  recentLeads: Lead[]
  activities: Activity[]
}

// ---------------------------------------------------------------
// Animation
// ---------------------------------------------------------------
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

// ---------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------
type IconType = React.ComponentType<{ size?: number; className?: string }>

const DONUT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

function CardShell({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'card-premium bg-card text-card-foreground rounded-xl border border-border/60 p-5 md:p-6 shadow-soft',
        'transition-all duration-300 hover:-translate-y-px hover:shadow-glow',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight truncate">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

/** Format a due date — uses relTime for past items, "in Xd/h" for future ones. */
function dueLabel(date?: string | null) {
  if (!date) return 'No due date'
  const d = new Date(date)
  const diff = (d.getTime() - Date.now()) / 1000
  if (diff < 0) return `Overdue · ${relTime(date)}`
  if (diff < 3600) return `Due in ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `Due in ${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 7) return `Due in ${Math.floor(diff / 86400)}d`
  return `Due ${d.toLocaleDateString()}`
}

// ---------------------------------------------------------------
// 1. KPI strip
// ---------------------------------------------------------------
function KpiCard({
  label,
  value,
  delta,
  deltaPositive,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  delta: string
  deltaPositive: boolean
  icon: IconType
  accent: string
}) {
  return (
    <div className="card-premium relative overflow-hidden bg-card text-card-foreground rounded-xl border border-border/60 p-5 shadow-soft transition-all duration-300 hover:-translate-y-px hover:shadow-glow">
      {/* gradient accent line on top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${accent}, color-mix(in oklch, ${accent} 30%, transparent))`,
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
          style={{
            background: `color-mix(in oklch, ${accent} 14%, transparent)`,
            color: accent,
          }}
        >
          <Icon size={15} />
        </div>
      </div>
      <div className="text-2xl md:text-[28px] font-semibold tracking-tight tabular-nums leading-none">
        {value}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 font-medium tabular-nums',
            deltaPositive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          )}
        >
          {deltaPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {delta}
        </span>
        <span className="text-muted-foreground">vs last month</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// 2. Revenue chart (Area chart)
// ---------------------------------------------------------------
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-soft text-xs">
      <div className="font-medium mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}</span>
          <span className="ml-auto font-medium tabular-nums">
            {money(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

function RevenueChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <CardShell className="h-full flex flex-col">
      <CardHead
        title="Revenue & Pipeline"
        subtitle="Last 6 months"
        action={
          <div className="flex items-center gap-3 text-[11px]">
            <Legend color="var(--chart-1)" label="Revenue" />
            <Legend color="var(--chart-2)" label="Pipeline" />
          </div>
        }
      />
      <div className="h-[260px] -ml-2 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
              width={36}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--background)', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="pipeline"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="url(#pipeGrad)"
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--background)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------
// 3. Lead Sources donut
// ---------------------------------------------------------------
function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: { fill?: string } }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-soft text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: p.payload?.fill }} />
        <span className="text-muted-foreground capitalize">{p.name}</span>
        <span className="ml-auto font-medium tabular-nums">{p.value}</span>
      </div>
    </div>
  )
}

function LeadSourcesDonut({
  data,
  total,
}: {
  data: LeadSource[]
  total: number
}) {
  return (
    <CardShell className="h-full flex flex-col">
      <CardHead title="Lead Sources" subtitle="By channel" />
      {data.length === 0 ? (
        <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">
          No lead sources yet
        </div>
      ) : (
        <div className="relative h-[180px] my-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} cursor={false} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-semibold tabular-nums">{total}</span>
            <span className="text-[11px] text-muted-foreground">total leads</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
        {data.slice(0, 6).map((s, i) => (
          <div key={s.name} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="truncate text-muted-foreground capitalize">{s.name}</span>
            <span className="ml-auto font-medium tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------
// 4. Pipeline overview (stacked horizontal bars)
// ---------------------------------------------------------------
function PipelineOverview({ pipelines }: { pipelines: PipelineSummary[] }) {
  return (
    <CardShell className="h-full flex flex-col">
      <CardHead title="Pipeline Health" subtitle="Value by stage" />
      {pipelines.length === 0 ? (
        <div className="text-xs text-muted-foreground py-10 text-center flex-1">
          No pipelines configured
        </div>
      ) : (
        <div className="space-y-5 flex-1">
          {pipelines.map((p) => {
            const total = p.stages.reduce((s, st) => s + st.value, 0)
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium truncate">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums ml-2">
                    {money(total)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                  {p.stages.map((st) => {
                    const w = total > 0 ? (st.value / total) * 100 : 0
                    if (w === 0) return null
                    return (
                      <div
                        key={st.id}
                        className="h-full transition-all group relative cursor-default"
                        style={{ width: `${w}%`, background: st.color }}
                      >
                        {/* hover tooltip */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-9 hidden group-hover:flex items-center gap-1 px-2 py-1 rounded-md bg-popover border border-border/60 text-[10px] whitespace-nowrap shadow-soft z-10">
                          <span className="font-medium">{st.name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="tabular-nums">{money(st.value)}</span>
                          <span className="text-muted-foreground">
                            ({st.dealCount} {st.dealCount === 1 ? 'deal' : 'deals'})
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {total === 0 && (
                    <div className="h-full w-full bg-muted/50" />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {p.stages
                    .filter((s) => s.value > 0)
                    .map((st) => (
                      <span
                        key={st.id}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: st.color }}
                        />
                        {st.name}
                        <span className="tabular-nums text-foreground/70">
                          {st.dealCount}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

// ---------------------------------------------------------------
// 5. Upcoming Tasks
// ---------------------------------------------------------------
function TasksList({ tasks }: { tasks: Task[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <CardShell className="h-full flex flex-col">
      <CardHead
        title="Upcoming Tasks"
        subtitle="Next due"
        action={
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        }
      />
      {tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground py-10 text-center flex-1">
          No upcoming tasks
        </div>
      ) : (
        <div className="flex-1 -mx-2 max-h-[300px] overflow-y-auto scroll-area">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => openDrawer('task', t.id)}
              className="w-full group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <PriorityPill priority={t.priority} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{t.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {dueLabel(t.dueDate)}
                </div>
              </div>
              {t.assignee && (
                <Avatar
                  name={t.assignee.name}
                  url={t.assignee.avatarUrl}
                  size={24}
                />
              )}
              <ChevronRight
                size={14}
                className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0"
              />
            </button>
          ))}
        </div>
      )}
    </CardShell>
  )
}

// ---------------------------------------------------------------
// 6. Recent Leads
// ---------------------------------------------------------------
function RecentLeadsList({ leads }: { leads: Lead[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <CardShell className="h-full flex flex-col">
      <CardHead
        title="Recent Leads"
        subtitle="Newest first"
        action={
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {leads.length}
          </span>
        }
      />
      {leads.length === 0 ? (
        <div className="text-xs text-muted-foreground py-10 text-center flex-1">
          No leads yet
        </div>
      ) : (
        <div className="flex-1 -mx-2 max-h-[300px] overflow-y-auto scroll-area">
          {leads.map((l) => (
            <button
              key={l.id}
              onClick={() => openDrawer('lead', l.id)}
              className="w-full group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <Avatar
                name={l.fullName}
                url={l.contact?.avatarUrl}
                size={28}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{l.fullName}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {l.source ? (
                    <span className="capitalize">{l.source}</span>
                  ) : (
                    'no source'
                  )}
                  {l.company?.name ? ` · ${l.company.name}` : ''}
                </div>
              </div>
              <ScoreBar score={l.score} />
              <StatusDot status={l.status} />
              <ChevronRight
                size={14}
                className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0"
              />
            </button>
          ))}
        </div>
      )}
    </CardShell>
  )
}

// ---------------------------------------------------------------
// 7. Activity Feed (timeline)
// ---------------------------------------------------------------
function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <CardShell className="h-full flex flex-col">
      <CardHead title="Activity Feed" subtitle="Latest events" />
      {activities.length === 0 ? (
        <div className="text-xs text-muted-foreground py-10 text-center flex-1">
          No recent activity
        </div>
      ) : (
        <div className="flex-1 -mx-1 max-h-[360px] overflow-y-auto scroll-area">
          <ol className="relative pl-5">
            <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
            {activities.map((a) => (
              <li key={a.id} className="relative flex gap-3 py-2 pr-2">
                <span className="absolute -left-[14px] top-3.5 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
                <div className="shrink-0">
                  {a.actor ? (
                    <Avatar
                      name={a.actor.name}
                      url={a.actor.avatarUrl}
                      size={24}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted grid place-items-center">
                      <ActivityIcon
                        size={12}
                        className="text-muted-foreground"
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] leading-snug">
                    <span className="font-medium">
                      {a.actor?.name || 'System'}
                    </span>{' '}
                    <span className="text-muted-foreground">{a.summary}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {relTime(a.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </CardShell>
  )
}

// ---------------------------------------------------------------
// 8. Quick Actions
// ---------------------------------------------------------------
function QuickActions() {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const navigate = useAppStore((s) => s.navigate)

  const actions: {
    label: string
    icon: IconType
    onClick: () => void
    accent: string
  }[] = [
    {
      label: 'New Lead',
      icon: UserPlus,
      onClick: () => openDrawer('lead-new'),
      accent: 'var(--chart-1)',
    },
    {
      label: 'New Deal',
      icon: KanbanSquare,
      onClick: () => openDrawer('deal-new'),
      accent: 'var(--chart-2)',
    },
    {
      label: 'Import CSV',
      icon: Upload,
      onClick: () => navigate('import'),
      accent: 'var(--chart-3)',
    },
    {
      label: 'New Task',
      icon: ListTodo,
      onClick: () => openDrawer('task-new'),
      accent: 'var(--chart-4)',
    },
  ]

  return (
    <CardShell className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/60 hover:border-border hover:bg-muted/40 transition-all text-left"
            >
              <div
                className="w-9 h-9 rounded-lg grid place-items-center shrink-0 transition-transform group-hover:scale-105"
                style={{
                  background: `color-mix(in oklch, ${a.accent} 14%, transparent)`,
                  color: a.accent,
                }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{a.label}</div>
              </div>
              <ChevronRight
                size={14}
                className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0"
              />
            </button>
          )
        })}
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------
function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 p-4 md:p-6">
      <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
      <div className="col-span-12">
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
      <div className="col-span-12 lg:col-span-8">
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="col-span-12 lg:col-span-4">
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------
function DashboardEmpty() {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="grid place-items-center p-4 md:p-10 min-h-[60vh]">
      <EmptyState
        icon={<Sparkles size={20} />}
        title="Welcome to your dashboard"
        hint="Once you start adding leads, deals, and tasks, your key metrics, charts, and recent activity will appear here."
        action={
          <div className="flex gap-2">
            <Button onClick={() => openDrawer('lead-new')}>
              <UserPlus size={14} />
              New Lead
            </Button>
            <Button variant="outline" onClick={() => navigate('import')}>
              <Upload size={14} />
              Import CSV
            </Button>
          </div>
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------
// Main DashboardView
// ---------------------------------------------------------------
export function DashboardView() {
  const { data: raw, isLoading } = useDashboard()
  const data = raw as DashboardData | undefined

  if (isLoading) return <DashboardSkeleton />
  if (!data) return <DashboardEmpty />

  const m = data.metrics
  const isEmpty =
    !m ||
    (m.revenue === 0 &&
      m.pipelineValue === 0 &&
      m.dealCount === 0 &&
      m.leadCount === 0 &&
      (data.activities?.length ?? 0) === 0 &&
      (data.upcomingTasks?.length ?? 0) === 0)
  if (isEmpty) return <DashboardEmpty />

  const kpis = [
    {
      label: 'Revenue',
      value: money(m.revenue),
      delta: '+12.4%',
      deltaPositive: true,
      icon: DollarSign,
      accent: 'var(--chart-2)',
    },
    {
      label: 'Pipeline Value',
      value: money(m.pipelineValue),
      delta: '+8.1%',
      deltaPositive: true,
      icon: TrendingUp,
      accent: 'var(--chart-1)',
    },
    {
      label: 'Open Deals',
      value: String(m.openDeals ?? 0),
      delta: '+3',
      deltaPositive: true,
      icon: Target,
      accent: 'var(--chart-4)',
    },
    {
      label: 'Conversion Rate',
      value: `${m.conversionRate ?? 0}%`,
      delta: '-1.2%',
      deltaPositive: false,
      icon: Percent,
      accent: 'var(--chart-5)',
    },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 gap-4 p-4 md:p-6"
    >
      {/* KPI strip */}
      <motion.div
        variants={item}
        className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </motion.div>

      {/* Quick actions */}
      <motion.div variants={item} className="col-span-12">
        <QuickActions />
      </motion.div>

      {/* Revenue chart */}
      <motion.div variants={item} className="col-span-12 lg:col-span-8">
        <RevenueChart data={data.monthly || []} />
      </motion.div>

      {/* Lead sources donut */}
      <motion.div variants={item} className="col-span-12 lg:col-span-4">
        <LeadSourcesDonut
          data={data.leadSources || []}
          total={m.leadCount ?? 0}
        />
      </motion.div>

      {/* Pipeline overview */}
      <motion.div variants={item} className="col-span-12 lg:col-span-6">
        <PipelineOverview pipelines={data.pipelines || []} />
      </motion.div>

      {/* Upcoming tasks */}
      <motion.div variants={item} className="col-span-12 lg:col-span-6">
        <TasksList tasks={data.upcomingTasks || []} />
      </motion.div>

      {/* Recent leads */}
      <motion.div variants={item} className="col-span-12 lg:col-span-6">
        <RecentLeadsList leads={data.recentLeads || []} />
      </motion.div>

      {/* Activity feed */}
      <motion.div variants={item} className="col-span-12 lg:col-span-6">
        <ActivityFeed activities={data.activities || []} />
      </motion.div>
    </motion.div>
  )
}
