/** Small shared utilities for CRM views. */
import { cn } from '@/lib/utils'

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const colors: Record<string, string> = {
    new: 'bg-slate-400',
    contacted: 'bg-blue-500',
    qualified: 'bg-violet-500',
    converted: 'bg-emerald-500',
    unqualified: 'bg-rose-500',
    active: 'bg-emerald-500',
    inactive: 'bg-slate-400',
    churned: 'bg-rose-500',
    subscribed: 'bg-emerald-500',
    unsubscribed: 'bg-amber-500',
    bounced: 'bg-rose-500',
    todo: 'bg-slate-400',
    in_progress: 'bg-blue-500',
    done: 'bg-emerald-500',
    canceled: 'bg-rose-500',
  }
  return <span className={cn('inline-block w-2 h-2 rounded-full', colors[status] || 'bg-slate-400', className)} />
}

export function PriorityPill({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
    medium: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    high: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    urgent: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  }
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide', colors[priority] || colors.medium)}>
      {priority}
    </span>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{score}</span>
    </div>
  )
}

export function Avatar({ name, url, size = 28, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className={cn('rounded-full object-cover', className)} style={{ width: size, height: size }} />
  }
  return (
    <div
      className={cn('rounded-full flex items-center justify-center bg-primary/10 text-primary font-medium', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  )
}

export function TagChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ background: `${color}22`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

/** Indian Rupee formatting with Indian number system (lakh/crore grouping). */
export function money(n: number, _currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

export function relTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-3">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionHeader({ title, count, actions }: { title: string; count?: number; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{count}</span>
        )}
      </div>
      {actions}
    </div>
  )
}
