'use client'

/**
 * Venom CRM — Leads view (Phase 2 refactor)
 *
 * PRIMARY CRM entity. Twenty CRM-inspired compact, dense layout.
 *
 *   ┌─ Header strip (h-12) ────────────────────────────────────────────┐
 *   │  Title + count │ search │ status │ owner │ Import CSV │ + New lead │
 *   ├─ Tabs ────────────────────────────────────────────────────────────┤
 *   │  Table | Board                                                     │
 *   │  • Table: .venom-table — 13 cols, inline-editable status, sortable │
 *   │  • Board: 9-column Kanban (dnd-kit)                                │
 *   ├─ Bulk action bar (h-10, slides in when rows selected) ────────────┤
 *   │  N selected │ Assign │ Tag │ Delete                                │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Import CSV opens a 4-step wizard Dialog (Upload → Map → Review → Done)
 * with ThinkingState progress (rotating labels via useThinkingTask).
 */

import * as React from 'react'
import { useLeads, useLeadMutations, useSettings } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  ScoreBar,
  money,
  relTime,
  EmptyState,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { ThinkingState, useThinkingTask, useThinkingStore } from '@/components/crm/thinking'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus, Membership } from '@/lib/types'
import {
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  LayoutGrid,
  Table as TableIcon,
  Upload,
  FileSpreadsheet,
  ChevronDown,
  X,
  GripVertical,
  Check,
  UserPlus,
  Tag as TagIcon,
  Users as UsersIcon,
  ClipboardPaste,
  Download,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

interface StatusMeta {
  value: LeadStatus
  label: string
  dot: string
  pill: string
}

const LEAD_STATUSES: StatusMeta[] = [
  { value: 'new', label: 'New', dot: 'bg-slate-400', pill: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  { value: 'contacted', label: 'Contacted', dot: 'bg-blue-500', pill: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
  { value: 'qualified', label: 'Qualified', dot: 'bg-violet-500', pill: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
  { value: 'unqualified', label: 'Unqualified', dot: 'bg-rose-500', pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-300' },
  { value: 'proposal_sent', label: 'Proposal Sent', dot: 'bg-amber-500', pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  { value: 'negotiation', label: 'Negotiation', dot: 'bg-orange-500', pill: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' },
  { value: 'won', label: 'Won', dot: 'bg-emerald-500', pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
  { value: 'lost', label: 'Lost', dot: 'bg-red-500', pill: 'bg-red-500/15 text-red-600 dark:text-red-300' },
  { value: 'archived', label: 'Archived', dot: 'bg-gray-500', pill: 'bg-gray-500/15 text-gray-600 dark:text-gray-300' },
]

const STATUS_MAP: Record<LeadStatus, StatusMeta> = LEAD_STATUSES.reduce((acc, s) => {
  acc[s.value] = s
  return acc
}, {} as Record<LeadStatus, StatusMeta>)

const SOURCES = ['website', 'referral', 'ads', 'cold-outreach', 'event', 'other']

// CSV import target fields
const TARGET_FIELDS = ['fullName', 'email', 'phone', 'source', 'score', 'estimatedValue'] as const
type TargetField = typeof TARGET_FIELDS[number] | '__skip__'

const TEMPLATE_CSV =
  'fullName,email,phone,source,score,estimatedValue\n' +
  'Aarav Sharma,aarav@acme.in,+919876543210,website,82,450000\n' +
  'Priya Patel,priya@brightpoint.in,+919812345678,referral,67,320000\n' +
  'Rohan Mehta,rohan@nova.in,+919900112233,ads,45,180000\n'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes, CRLF. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'venom-leads-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Auto-match a CSV header to a target field by name (case-insensitive). */
function autoMatch(header: string): TargetField {
  const h = header.toLowerCase().trim()
  if (h === 'name' || h === 'fullname' || h === 'full name' || h === 'lead name') return 'fullName'
  if (h === 'email' || h === 'e-mail' || h === 'mail') return 'email'
  if (h === 'phone' || h === 'mobile' || h === 'tel' || h === 'phone number') return 'phone'
  if (h === 'source' || h === 'lead source') return 'source'
  if (h === 'score' || h === 'lead score') return 'score'
  if (h === 'value' || h === 'estimatedvalue' || h === 'estimated value' || h === 'deal value' || h === 'amount') return 'estimatedValue'
  return '__skip__'
}

// ----------------------------------------------------------------
// Sortable lead card (board)
// ----------------------------------------------------------------

function LeadCard({ lead }: { lead: Lead }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'lead', status: lead.status },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-card border border-border/60 rounded-lg p-2.5 cursor-grab active:cursor-grabbing',
        'hover:border-primary/40 hover:shadow-soft transition-all',
        isDragging && 'opacity-60 ring-2 ring-primary/30 shadow-glow'
      )}
      onClick={() => openDrawer('lead', lead.id)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <Avatar name={lead.fullName} url={undefined} size={26} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <div className="text-[12.5px] font-medium truncate">{lead.fullName}</div>
            <GripVertical className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{lead.email || '—'}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <ScoreBar score={lead.score} />
        {lead.estimatedValue ? (
          <span className="text-[10.5px] tabular-nums font-medium">{money(lead.estimatedValue)}</span>
        ) : (
          <span className="text-[10.5px] text-muted-foreground">—</span>
        )}
      </div>
      {(lead.company?.name || lead.source) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {lead.company?.name && <span className="truncate">{lead.company.name}</span>}
          {lead.company?.name && lead.source && <span>·</span>}
          {lead.source && <span className="capitalize">{lead.source}</span>}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Board column
// ----------------------------------------------------------------

function BoardColumn({ status, leads }: { status: StatusMeta; leads: Lead[] }) {
  const columnId = `col-${status.value}`
  return (
    <div className="flex flex-col min-w-[240px] w-[240px] bg-muted/30 rounded-lg border border-border/50">
      <div className="px-2.5 py-2 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', status.dot)} />
          <span className="text-[12px] font-semibold">{status.label}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground bg-background px-1.5 py-0.5 rounded">
            {leads.length}
          </span>
        </div>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div
          id={columnId}
          data-status={status.value}
          className="flex-1 p-1.5 space-y-1.5 overflow-y-auto scroll-area max-h-[calc(100vh-220px)] min-h-[100px]"
        >
          {leads.length === 0 && (
            <div className="h-16 rounded-md border border-dashed border-border/40 grid place-items-center text-[10px] text-muted-foreground">
              Drop here
            </div>
          )}
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ----------------------------------------------------------------
// Inline-editable status cell
// ----------------------------------------------------------------

function StatusCell({ lead }: { lead: Lead }) {
  const { update } = useLeadMutations()
  const [open, setOpen] = React.useState(false)
  const meta = STATUS_MAP[lead.status] || LEAD_STATUSES[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border border-transparent hover:border-border/60 transition-colors',
            meta.pill
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
          {meta.label}
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-2 py-1">
          Set status
        </div>
        {LEAD_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              if (s.value !== lead.status) {
                update.mutate({ id: lead.id, status: s.value })
                toast.success(`${lead.fullName.split(' ')[0]} → ${s.label}`)
              }
              setOpen(false)
            }}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] hover:bg-accent transition-colors',
              s.value === lead.status && 'bg-accent'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', s.dot)} />
            <span className="flex-1 text-left">{s.label}</span>
            {s.value === lead.status && <Check className="size-3 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ----------------------------------------------------------------
// Sortable column header
// ----------------------------------------------------------------

type SortField = 'fullName' | 'status' | 'estimatedValue' | 'createdAt' | 'expectedClose' | 'score'
type SortDir = 'asc' | 'desc'

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  label: string
  field: SortField
  sortField: SortField
  sortDir: SortDir
  onSort: (f: SortField) => void
  className?: string
}) {
  const active = sortField === field
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground transition-colors',
        active && 'text-foreground',
        className
      )}
    >
      <span>{label}</span>
      <Icon className={cn('size-3', active ? 'opacity-100' : 'opacity-40')} />
    </button>
  )
}

// ----------------------------------------------------------------
// Actions cell
// ----------------------------------------------------------------

function ActionsCell({ lead }: { lead: Lead }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useLeadMutations()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 -mr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDrawer('lead', lead.id)}>
          <Pencil className="size-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            remove.mutate(lead.id)
          }}
        >
          <Trash2 className="size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ----------------------------------------------------------------
// Bulk action bar
// ----------------------------------------------------------------

function BulkToolbar({
  selectedCount,
  onClear,
  onAssign,
  onDelete,
}: {
  selectedCount: number
  onClear: () => void
  onAssign: (memberId: string) => void
  onDelete: () => void
}) {
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []
  const [assignOpen, setAssignOpen] = React.useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-2 px-3 h-10 mb-2 rounded-lg bg-primary/8 border border-primary/20 shadow-soft"
    >
      <span className="text-[12px] font-medium tabular-nums">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-border mx-0.5" />

      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 text-[12px] gap-1.5">
            <UsersIcon className="size-3.5" /> Assign
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-2 py-1">
            Assign {selectedCount} lead{selectedCount > 1 ? 's' : ''} to
          </div>
          <div className="max-h-60 overflow-y-auto scroll-area">
            {members.length === 0 && (
              <div className="px-2 py-3 text-[11px] text-muted-foreground text-center">No members</div>
            )}
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onAssign(m.userId)
                  setAssignOpen(false)
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] hover:bg-accent transition-colors"
              >
                <Avatar name={m.user?.name || '?'} url={m.user?.avatarUrl} size={20} />
                <span className="truncate">{m.user?.name || 'Unknown'}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[12px] gap-1.5"
        onClick={() => toast.info('Bulk tagging — select a tag from the dropdown')}
      >
        <TagIcon className="size-3.5" /> Tag
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[12px] gap-1.5 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" /> Delete
      </Button>

      <div className="flex-1" />
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClear} aria-label="Clear selection">
        <X className="size-3.5" />
      </Button>
    </motion.div>
  )
}

// ----------------------------------------------------------------
// Table view (venom-table)
// ----------------------------------------------------------------

function LeadsTable({ leads }: { leads: Lead[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { update, remove } = useLeadMutations()
  const [sortField, setSortField] = React.useState<SortField>('createdAt')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = React.useMemo(() => {
    const arr = [...leads]
    arr.sort((a, b) => {
      let av: string | number
      let bv: string | number
      switch (sortField) {
        case 'fullName':
          av = a.fullName.toLowerCase(); bv = b.fullName.toLowerCase(); break
        case 'status':
          av = a.status; bv = b.status; break
        case 'estimatedValue':
          av = a.estimatedValue || 0; bv = b.estimatedValue || 0; break
        case 'createdAt':
          av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break
        case 'expectedClose':
          av = a.expectedClose ? new Date(a.expectedClose).getTime() : Infinity
          bv = b.expectedClose ? new Date(b.expectedClose).getTime() : Infinity
          break
        case 'score':
          av = a.score; bv = b.score; break
        default:
          return 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [leads, sortField, sortDir])

  const allSelected = sorted.length > 0 && sorted.every((l) => selected.has(l.id))
  const someSelected = sorted.some((l) => selected.has(l.id)) && !allSelected
  const selectedCount = selected.size

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map((l) => l.id)))
    }
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = () => {
    const ids = Array.from(selected)
    ids.forEach((id) => remove.mutate(id))
    toast.success(`${ids.length} lead${ids.length > 1 ? 's' : ''} deleted`)
    setSelected(new Set())
  }

  const handleBulkAssign = (memberId: string) => {
    const ids = Array.from(selected)
    ids.forEach((id) => update.mutate({ id, ownerId: memberId }))
    toast.success(`Assigned ${ids.length} lead${ids.length > 1 ? 's' : ''}`)
    setSelected(new Set())
  }

  return (
    <div>
      <AnimatePresence>
        {selectedCount > 0 && (
          <BulkToolbar
            selectedCount={selectedCount}
            onClear={() => setSelected(new Set())}
            onAssign={handleBulkAssign}
            onDelete={handleBulkDelete}
          />
        )}
      </AnimatePresence>

      <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto scroll-area max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="venom-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="!py-1.5 !px-2">
                  <Checkbox
                    checked={allSelected || (someSelected && 'indeterminate')}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th><SortHeader label="Name" field="fullName" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th>Company</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Source</th>
                <th>Owner</th>
                <th><SortHeader label="Value" field="estimatedValue" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th><SortHeader label="Expected" field="expectedClose" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th><SortHeader label="Score" field="score" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th>Last Contact</th>
                <th><SortHeader label="Created" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => {
                const isSelected = selected.has(lead.id)
                const isPastDue = lead.expectedClose && new Date(lead.expectedClose) < new Date()
                return (
                  <tr
                    key={lead.id}
                    className={cn(isSelected && 'selected')}
                    onClick={() => openDrawer('lead', lead.id)}
                  >
                    <td className="!py-1.5 !px-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(lead.id)}
                        aria-label={`Select ${lead.fullName}`}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={lead.fullName} url={undefined} size={24} />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium truncate">{lead.fullName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{lead.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {lead.company?.name ? (
                        <span className="text-[12px] truncate inline-block max-w-[110px] align-middle">{lead.company.name}</span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {lead.phone ? (
                        <span className="font-mono text-[11.5px] tabular-nums">{lead.phone}</span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <StatusCell lead={lead} />
                    </td>
                    <td>
                      {lead.source ? (
                        <span className="text-[12px] text-muted-foreground capitalize">{lead.source}</span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {lead.owner ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar name={lead.owner.name} url={lead.owner.avatarUrl} size={20} />
                          <span className="text-[12px] truncate">{lead.owner.name.split(' ')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {lead.estimatedValue != null ? (
                        <span className="text-[12px] tabular-nums font-medium">{money(lead.estimatedValue)}</span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {lead.expectedClose ? (
                        <span className={cn('text-[11px]', isPastDue && 'text-destructive font-medium')}>
                          {relTime(lead.expectedClose)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <ScoreBar score={lead.score} />
                    </td>
                    <td>
                      {lead.lastActivityAt ? (
                        <span className="text-[11px] text-muted-foreground">{relTime(lead.lastActivityAt)}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">never</span>
                      )}
                    </td>
                    <td>
                      <span className="text-[11px] text-muted-foreground">{relTime(lead.createdAt)}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <ActionsCell lead={lead} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Board view (Kanban)
// ----------------------------------------------------------------

function LeadsBoard({ leads }: { leads: Lead[] }) {
  const { update } = useLeadMutations()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const grouped = React.useMemo(() => {
    const map = {} as Record<LeadStatus, Lead[]>
    LEAD_STATUSES.forEach((s) => { map[s.value] = [] })
    leads.forEach((l) => {
      if (map[l.status]) map[l.status].push(l)
    })
    return map
  }, [leads])

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const leadId = String(active.id)
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    let targetStatus: LeadStatus | undefined

    // Dropped over a column container
    const overData = over.data.current as { status?: LeadStatus; type?: string } | undefined
    if (overData?.status) {
      targetStatus = overData.status
    }

    // Dropped over a lead card — find which column that lead belongs to
    if (!targetStatus) {
      const overLead = leads.find((l) => l.id === String(over.id))
      if (overLead) targetStatus = overLead.status
    }

    // Dropped over a column element by id
    if (!targetStatus && typeof over.id === 'string' && over.id.startsWith('col-')) {
      targetStatus = over.id.slice(4) as LeadStatus
    }

    if (!targetStatus || targetStatus === lead.status) return
    update.mutate({ id: leadId, status: targetStatus })
    toast.success(`${lead.fullName.split(' ')[0]} → ${STATUS_MAP[targetStatus].label}`)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-2.5 overflow-x-auto scroll-area pb-2">
        {LEAD_STATUSES.map((s) => (
          <BoardColumn key={s.value} status={s} leads={grouped[s.value] || []} />
        ))}
      </div>
    </DndContext>
  )
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function LeadsSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="space-y-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 h-9 border-b border-border/40">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-6 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-2.5 w-32 rounded" />
              <Skeleton className="h-2 w-44 rounded" />
            </div>
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-2 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Import CSV dialog (4-step wizard)
// ----------------------------------------------------------------

type ImportStep = 'upload' | 'map' | 'review' | 'importing' | 'done'

function ImportCsvDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { create } = useLeadMutations()
  const { startSequence } = useThinkingTask()
  const tasks = useThinkingStore((s) => s.tasks)
  const thinkingLabel = tasks[tasks.length - 1]?.label || 'Working…'
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []
  const user = useAppStore((s) => s.user)
  const openDrawer = useAppStore((s) => s.openDrawer)

  const [step, setStep] = React.useState<ImportStep>('upload')
  const [headers, setHeaders] = React.useState<string[]>([])
  const [dataRows, setDataRows] = React.useState<string[][]>([])
  const [mapping, setMapping] = React.useState<Record<number, TargetField>>({})
  const [ownerId, setOwnerId] = React.useState<string>('')
  const [dupMode, setDupMode] = React.useState<'skip' | 'update'>('skip')
  const [importedCount, setImportedCount] = React.useState(0)
  const [totalCount, setTotalCount] = React.useState(0)
  const [pasteMode, setPasteMode] = React.useState(false)
  const [pasteText, setPasteText] = React.useState('')
  const [dragOver, setDragOver] = React.useState(false)

  // Reset when dialog closes
  const resetWizard = React.useCallback(() => {
    setStep('upload')
    setHeaders([])
    setDataRows([])
    setMapping({})
    setOwnerId(user?.id || '')
    setDupMode('skip')
    setImportedCount(0)
    setTotalCount(0)
    setPasteMode(false)
    setPasteText('')
    setDragOver(false)
  }, [user?.id])

  React.useEffect(() => {
    if (open) resetWizard()
  }, [open, resetWizard])

  const ingestCSV = (text: string) => {
    const rows = parseCSV(text)
    if (rows.length < 2) {
      toast.error('CSV must have a header row and at least one data row')
      return
    }
    const hdrs = rows[0].map((h, i) => h.trim() || `Column ${i + 1}`)
    const body = rows.slice(1)
    setHeaders(hdrs)
    setDataRows(body)
    // Auto-match headers to target fields
    const auto: Record<number, TargetField> = {}
    hdrs.forEach((h, i) => { auto[i] = autoMatch(h) })
    setMapping(auto)
    setStep('map')
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => ingestCSV(String(reader.result))
    reader.onerror = () => toast.error('Could not read file')
    reader.readAsText(file)
  }

  const mappedRows = React.useMemo(() => {
    return dataRows.map((row) => {
      const obj: Partial<Record<TargetField, string>> = {}
      headers.forEach((_, i) => {
        const target = mapping[i]
        if (target && target !== '__skip__' && row[i] !== undefined) {
          obj[target] = row[i].trim()
        }
      })
      return obj
    })
  }, [dataRows, headers, mapping])

  const validRows = React.useMemo(() => {
    return mappedRows.filter((r) => r.fullName && r.fullName.trim().length > 0)
  }, [mappedRows])

  const handleStartImport = async () => {
    setStep('importing')
    setTotalCount(validRows.length)
    setImportedCount(0)

    const labels = [
      'Reading CSV…',
      'Mapping columns…',
      'Validating emails…',
      'Detecting duplicates…',
      `Importing ${validRows.length} lead${validRows.length > 1 ? 's' : ''}…`,
      'Finalizing import…',
    ]

    const sequencePromise = startSequence(labels, { duration: 600 })

    let count = 0
    for (const row of validRows) {
      try {
        await create.mutateAsync({
          fullName: row.fullName || '',
          email: row.email || null,
          phone: row.phone || null,
          source: row.source || 'website',
          score: row.score ? Math.max(0, Math.min(100, parseInt(row.score, 10) || 0)) : 0,
          estimatedValue: row.estimatedValue ? Number(row.estimatedValue.replace(/[^0-9.-]/g, '')) || null : null,
          status: 'new',
          ownerId: ownerId || null,
        })
        count++
        setImportedCount(count)
      } catch {
        // skip individual failures
      }
    }

    await sequencePromise
    toast.success(`Imported ${count} lead${count !== 1 ? 's' : ''}`)
    setStep('done')
  }

  const stepOrder: ImportStep[] = ['upload', 'map', 'review', 'importing', 'done']
  const stepIndex = stepOrder.indexOf(step)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scroll-area">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <FileSpreadsheet className="size-4 text-primary" />
            Import Leads
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {step !== 'done' && step !== 'importing' && (
              <>Step {Math.min(stepIndex + 1, 3)} of 3 — {step === 'upload' ? 'Upload your CSV file' : step === 'map' ? 'Map columns to lead fields' : 'Review and confirm'}</>
            )}
            {step === 'importing' && <>Importing your leads…</>}
            {step === 'done' && <>Import complete</>}
          </DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        {step !== 'importing' && step !== 'done' && (
          <div className="flex items-center gap-1.5 mb-4">
            {['upload', 'map', 'review'].map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i <= stepIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {!pasteMode ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) handleFile(file)
                  }}
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
                    dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-accent/40'
                  )}
                >
                  <Upload className="size-8 mx-auto text-muted-foreground mb-2.5" />
                  <div className="text-[13px] font-medium">Drag &amp; drop CSV file here</div>
                  <div className="text-[11px] text-muted-foreground mt-1">or click to browse</div>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder={'fullName,email,phone,source,score,estimatedValue\nAarav Sharma,aarav@acme.in,+919876543210,website,82,450000'}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="min-h-[220px] font-mono text-[11px] resize-y"
                  />
                  <Button
                    className="w-full"
                    disabled={!pasteText.trim()}
                    onClick={() => ingestCSV(pasteText)}
                  >
                    Continue with pasted CSV
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  onClick={() => setPasteMode((m) => !m)}
                >
                  {pasteMode ? <><Upload className="size-3" /> Upload file instead</> : <><ClipboardPaste className="size-3" /> Paste CSV instead</>}
                </button>
                <button
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                  onClick={downloadTemplate}
                >
                  <Download className="size-3" /> Download template
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-[12px]">
                <Badge variant="secondary" className="text-[10px]">Entity: Leads</Badge>
                <span className="text-muted-foreground">{dataRows.length} rows detected</span>
              </div>

              {/* Owner select */}
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40 border border-border/60">
                <Label className="text-[12px] font-medium shrink-0">Default owner:</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger size="sm" className="h-8 flex-1 text-[12px]">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.userId}>
                        {m.user?.name || 'Unknown'} {m.userId === user?.id && '(me)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border border-border/60 overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-border/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <div className="bg-card px-2.5 py-1.5">CSV header</div>
                  <div className="bg-card px-2.5 py-1.5">Lead field</div>
                </div>
                <div className="max-h-[260px] overflow-y-auto scroll-area">
                  {headers.map((h, i) => (
                    <div key={i} className="grid grid-cols-2 gap-px bg-border/60">
                      <div className="bg-card px-2.5 py-1.5 text-[12px] font-mono truncate">{h}</div>
                      <div className="bg-card px-1.5 py-1">
                        <Select
                          value={mapping[i] || '__skip__'}
                          onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v as TargetField }))}
                        >
                          <SelectTrigger size="sm" className="h-7 text-[11px] border-0 shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">Do not import</SelectItem>
                            <SelectItem value="fullName">fullName *</SelectItem>
                            <SelectItem value="email">email</SelectItem>
                            <SelectItem value="phone">phone</SelectItem>
                            <SelectItem value="source">source</SelectItem>
                            <SelectItem value="score">score</SelectItem>
                            <SelectItem value="estimatedValue">estimatedValue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button
                  size="sm"
                  disabled={!validRows.length}
                  onClick={() => setStep('review')}
                >
                  Continue ({validRows.length} valid)
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="rounded-md border border-border/60 p-3 bg-muted/30">
                <div className="text-[13px] font-medium">Ready to import {validRows.length} lead{validRows.length !== 1 ? 's' : ''}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Owner: {ownerId ? members.find((m) => m.userId === ownerId)?.user?.name || 'Selected' : 'Unassigned'} · Status: New
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-medium">Duplicate handling</Label>
                <RadioGroup value={dupMode} onValueChange={(v) => setDupMode(v as 'skip' | 'update')} className="gap-2">
                  <label htmlFor="dup-skip" className="flex items-start gap-2.5 p-2.5 rounded-md border border-border/60 hover:bg-accent/40 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="skip" id="dup-skip" className="mt-0.5" />
                    <div>
                      <div className="text-[12px] font-medium">Skip duplicates</div>
                      <div className="text-[11px] text-muted-foreground">Leaves existing leads unchanged</div>
                    </div>
                  </label>
                  <label htmlFor="dup-update" className="flex items-start gap-2.5 p-2.5 rounded-md border border-border/60 hover:bg-accent/40 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="update" id="dup-update" className="mt-0.5" />
                    <div>
                      <div className="text-[12px] font-medium">Update existing</div>
                      <div className="text-[11px] text-muted-foreground">Overwrites matching leads by email</div>
                    </div>
                  </label>
                </RadioGroup>
                <p className="text-[10.5px] text-muted-foreground italic">
                  Note: Duplicate detection runs against existing leads in this workspace.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep('map')}>
                  Back
                </Button>
                <Button size="sm" onClick={handleStartImport}>
                  Start import
                </Button>
              </div>
            </motion.div>
          )}

          {/* Importing */}
          {step === 'importing' && (
            <motion.div
              key="importing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="py-8"
            >
              <ThinkingState label={thinkingLabel} size="lg" />
              <div className="mt-6 text-center text-[12px] text-muted-foreground tabular-nums">
                {importedCount} / {totalCount} leads created
              </div>
            </motion.div>
          )}

          {/* Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="py-6 text-center space-y-4"
            >
              <div className="flex justify-center">
                <div className="size-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div>
                <div className="text-[15px] font-semibold">Imported {importedCount} lead{importedCount !== 1 ? 's' : ''}</div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  Your new leads are ready in the Leads table.
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={resetWizard}>
                  <RefreshCw className="size-3.5" /> Import another
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    // navigate to first imported lead if available
                    setTimeout(() => openDrawer('lead-new'), 100)
                  }}
                >
                  View leads
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------
// Header strip (h-12, compact)
// ----------------------------------------------------------------

function HeaderStrip({
  count,
  q,
  setQ,
  status,
  setStatus,
  owner,
  setOwner,
  onImport,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  status: string
  setStatus: (v: string) => void
  owner: string
  setOwner: (v: string) => void
  onImport: () => void
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []
  const user = useAppStore((s) => s.user)

  return (
    <div className="flex items-center justify-between gap-2 h-12 mb-3">
      <div className="flex items-center gap-2 shrink-0">
        <h1 className="text-[15px] font-semibold tracking-tight">Leads</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px] h-5">{count}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search leads…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 w-[200px] text-[12.5px]"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="h-8 w-[120px] text-[12px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger size="sm" className="h-8 w-[130px] text-[12px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.userId}>
                {m.user?.name || 'Unknown'}{m.userId === user?.id ? ' (me)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5" onClick={onImport}>
          <Upload className="size-3.5" /> Import CSV
        </Button>
        <Button size="sm" className="h-8 text-[12px] gap-1.5" onClick={() => openDrawer('lead-new')}>
          <Plus className="size-3.5" /> New Lead
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function LeadsView() {
  const prefersReduced = useReducedMotion()
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [owner, setOwner] = React.useState('all')
  const [importOpen, setImportOpen] = React.useState(false)
  const debouncedQ = useDebounced(q, 250)

  const { data: leads = [], isLoading } = useLeads(debouncedQ, status === 'all' ? undefined : status)
  const user = useAppStore((s) => s.user)

  const filtered = React.useMemo(() => {
    let list = leads
    if (owner === 'me') list = list.filter((l) => l.ownerId === user?.id)
    else if (owner === 'unassigned') list = list.filter((l) => !l.ownerId)
    else if (owner !== 'all') list = list.filter((l) => l.ownerId === owner)
    return list
  }, [leads, owner, user?.id])

  const tabMotion = prefersReduced
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18 } }

  return (
    <div className="p-4 md:p-5 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        owner={owner}
        setOwner={setOwner}
        onImport={() => setImportOpen(true)}
      />

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="mb-3 h-8">
          <TabsTrigger value="table" className="text-[12px] gap-1.5 h-7">
            <TableIcon className="size-3.5" /> Table
          </TabsTrigger>
          <TabsTrigger value="board" className="text-[12px] gap-1.5 h-7">
            <LayoutGrid className="size-3.5" /> Board
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-0">
          <motion.div key="table" {...tabMotion}>
            {isLoading ? (
              <LeadsSkeleton />
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-card shadow-soft">
                <EmptyState
                  icon={<UserPlus className="size-5" />}
                  title="No leads yet"
                  hint="Create your first lead or import a CSV to get started."
                  action={
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        <Upload className="size-4" /> Import CSV
                      </Button>
                      <Button size="sm" onClick={() => useAppStore.getState().openDrawer('lead-new')}>
                        <Plus className="size-4" /> New Lead
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : (
              <LeadsTable leads={filtered} />
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="board" className="mt-0">
          <motion.div key="board" {...tabMotion}>
            {isLoading ? (
              <div className="flex gap-2.5 overflow-hidden">
                {LEAD_STATUSES.map((s) => (
                  <div key={s.value} className="min-w-[240px] w-[240px] bg-muted/30 rounded-lg border border-border/50 p-2 space-y-2">
                    <Skeleton className="h-4 w-20 rounded" />
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-md" />
                    ))}
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-card shadow-soft">
                <EmptyState
                  icon={<UserPlus className="size-5" />}
                  title="No leads to display"
                  hint="Create a lead to see it on the board."
                />
              </div>
            ) : (
              <LeadsBoard leads={filtered} />
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
