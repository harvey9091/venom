'use client'

/**
 * Pulse CRM — Leads view
 *
 * Layout:
 *   ┌─ Header strip ────────────────────────────────────────┐
 *   │  Title + count badge │ search │ filters │ + New lead    │
 *   ├─ Tabs ─────────────────────────────────────────────────┤
 *   │  Table | Board                                          │
 *   │  • Table: TanStack Table w/ sortable cols + selection   │
 *   │  • Board: Kanban grouped by LeadStatus (dnd-kit)        │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Bulk action toolbar appears above the table when rows are selected.
 * Search input is debounced 300ms.
 */

import * as React from 'react'
import { useLeads, useLeadMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  ScoreBar,
  StatusDot,
  money,
  relTime,
  EmptyState,
  TagChip,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable, arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/lib/types'
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
  UserPlus,
  Users as UsersIcon,
  Tag as TagIcon,
  X,
  GripVertical,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const LEAD_STATUSES: { value: LeadStatus; label: string; accent: string }[] = [
  { value: 'new', label: 'New', accent: 'bg-slate-400' },
  { value: 'contacted', label: 'Contacted', accent: 'bg-blue-500' },
  { value: 'qualified', label: 'Qualified', accent: 'bg-violet-500' },
  { value: 'unqualified', label: 'Unqualified', accent: 'bg-rose-500' },
  { value: 'converted', label: 'Converted', accent: 'bg-emerald-500' },
]

const SOURCES = ['website', 'referral', 'ads', 'cold-outreach', 'event', 'other']

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function statusLabel(s: string) {
  return LEAD_STATUSES.find((x) => x.value === s)?.label || s
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
        'group card-premium bg-card border border-border/60 rounded-lg p-3 shadow-soft cursor-grab active:cursor-grabbing',
        'hover:-translate-y-px hover:shadow-glow transition-all',
        isDragging && 'opacity-50 rotate-1 shadow-glow ring-2 ring-primary/30'
      )}
      onClick={() => openDrawer('lead', lead.id)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={lead.fullName} url={lead.owner?.avatarUrl} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-medium truncate">{lead.fullName}</div>
            <GripVertical className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{lead.email || '—'}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <ScoreBar score={lead.score} />
        {lead.estimatedValue ? (
          <span className="text-[11px] tabular-nums font-medium text-foreground/80">
            {money(lead.estimatedValue)}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </div>
      {(lead.company?.name || lead.source) && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {lead.company?.name && <span className="truncate">{lead.company.name}</span>}
          {lead.company?.name && lead.source && <span>·</span>}
          {lead.source && <span className="capitalize">{lead.source}</span>}
        </div>
      )}
      {lead.tags && lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <TagChip key={t.id} label={t.name} color={t.color} />
          ))}
          {lead.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{lead.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Board column
// ----------------------------------------------------------------

function BoardColumn({
  status,
  leads,
  onMove,
}: {
  status: { value: LeadStatus; label: string; accent: string }
  leads: Lead[]
  onMove: (id: string, status: LeadStatus) => void
}) {
  const columnId = `col-${status.value}`
  return (
    <div className="flex flex-col min-w-[260px] w-[260px] bg-muted/40 rounded-xl border border-border/60">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', status.accent)} />
          <span className="text-[12px] font-semibold">{status.label}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground bg-background px-1.5 py-0.5 rounded">
            {leads.length}
          </span>
        </div>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Add lead to this column"
          onClick={() => onMove('__new__', status.value)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto scroll-area max-h-[calc(100vh-260px)] min-h-[120px]">
          {leads.length === 0 && (
            <div className="h-20 rounded-lg border border-dashed border-border/50 grid place-items-center text-[11px] text-muted-foreground">
              Drop leads here
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
// Table view (TanStack Table)
// ----------------------------------------------------------------

function ActionsCell({ lead }: { lead: Lead }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useLeadMutations()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 -mr-1" onClick={(e) => e.stopPropagation()}>
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
          onClick={() => remove.mutate(lead.id)}
        >
          <Trash2 className="size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortableHeader({ column, children }: { column: any; children: React.ReactNode }) {
  const sorted = column.getIsSorted()
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <button
      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-muted-foreground"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      <span>{children}</span>
      <Icon className={cn('size-3', sorted ? 'text-foreground' : 'opacity-50')} />
    </button>
  )
}

const columns: ColumnDef<Lead>[] = [
  {
    id: 'select',
    size: 32,
    header: ({ table }: any) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }: any) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'fullName',
    header: ({ column }: any) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }: any) => {
      const lead = row.original as Lead
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={lead.fullName} url={undefined} size={28} />
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{lead.fullName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{lead.email || '—'}</div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }: any) => <SortableHeader column={column}>Email</SortableHeader>,
    cell: ({ row }: any) => (
      <span className="text-[12px] text-muted-foreground">{row.original.email || '—'}</span>
    ),
  },
  {
    id: 'company',
    accessorFn: (r: Lead) => r.company?.name || '',
    header: ({ column }: any) => <SortableHeader column={column}>Company</SortableHeader>,
    cell: ({ row }: any) => {
      const c = (row.original as Lead).company
      return c ? <span className="text-[12px]">{c.name}</span> : <span className="text-[12px] text-muted-foreground">—</span>
    },
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }: any) => {
      const s = row.original.source
      return s ? (
        <Badge variant="outline" className="text-[10px] capitalize font-medium">{s}</Badge>
      ) : (
        <span className="text-[12px] text-muted-foreground">—</span>
      )
    },
  },
  {
    accessorKey: 'score',
    header: ({ column }: any) => <SortableHeader column={column}>Score</SortableHeader>,
    cell: ({ row }: any) => <ScoreBar score={row.original.score} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => {
      const s = row.original.status as string
      return (
        <div className="inline-flex items-center gap-1.5">
          <StatusDot status={s} />
          <span className="text-[12px]">{statusLabel(s)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'estimatedValue',
    header: ({ column }: any) => <SortableHeader column={column}>Value</SortableHeader>,
    cell: ({ row }: any) => {
      const v = row.original.estimatedValue
      return v ? (
        <span className="text-[12px] tabular-nums font-medium">{money(v)}</span>
      ) : (
        <span className="text-[12px] text-muted-foreground">—</span>
      )
    },
  },
  {
    id: 'owner',
    accessorFn: (r: Lead) => r.owner?.name || '',
    header: 'Owner',
    cell: ({ row }: any) => {
      const o = (row.original as Lead).owner
      return o ? (
        <div className="flex items-center gap-1.5">
          <Avatar name={o.name} url={o.avatarUrl} size={22} />
          <span className="text-[12px]">{o.name.split(' ')[0]}</span>
        </div>
      ) : (
        <span className="text-[12px] text-muted-foreground">Unassigned</span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }: any) => <SortableHeader column={column}>Created</SortableHeader>,
    cell: ({ row }: any) => (
      <span className="text-[11px] text-muted-foreground">{relTime(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'actions',
    size: 48,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }: any) => <ActionsCell lead={row.original as Lead} />,
  },
]

function BulkToolbar({
  selectedCount,
  onClear,
  onDelete,
}: {
  selectedCount: number
  onClear: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-primary/8 border border-primary/20 shadow-soft">
      <span className="text-[12px] font-medium">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-border mx-1" />
      <Button size="sm" variant="ghost" className="h-7 text-[12px]" onClick={() => toast.info('Bulk assign — coming soon')}>
        <UsersIcon className="size-3.5" /> Assign
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-[12px]" onClick={() => toast.info('Bulk tag — coming soon')}>
        <TagIcon className="size-3.5" /> Tag
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-[12px] text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
      <div className="flex-1" />
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClear} aria-label="Clear selection">
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

function LeadsTable({ leads }: { leads: Lead[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useLeadMutations()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const handleBulkDelete = () => {
    selectedRows.forEach((r) => remove.mutate(r.original.id))
    setRowSelection({})
    toast.success(`${selectedCount} lead${selectedCount > 1 ? 's' : ''} deleted`)
  }

  return (
    <div>
      {selectedCount > 0 && (
        <BulkToolbar
          selectedCount={selectedCount}
          onClear={() => setRowSelection({})}
          onDelete={handleBulkDelete}
        />
      )}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto scroll-area">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent border-border/60">
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                      className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground h-9 px-3"
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <EmptyState
                      icon={<UserPlus className="size-5" />}
                      title="No leads match your filters"
                      hint="Try adjusting the search query or status filter."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="cursor-pointer border-border/40 group"
                    onClick={() => openDrawer('lead', row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5 px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Board view
// ----------------------------------------------------------------

function LeadsBoard({ leads }: { leads: Lead[] }) {
  const { update } = useLeadMutations()
  const openDrawer = useAppStore((s) => s.openDrawer)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const grouped = React.useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      new: [],
      contacted: [],
      qualified: [],
      unqualified: [],
      converted: [],
    }
    leads.forEach((l) => map[l.status]?.push(l))
    return map
  }, [leads])

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const leadId = String(active.id)
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    // Determine target column.
    // `over.data.current.status` is set by SortableContext items; if dropped on empty
    // area, fall back to parsing the column id from the over id.
    let targetStatus: LeadStatus | undefined =
      (over.data.current as any)?.status as LeadStatus | undefined

    if (!targetStatus && typeof over.id === 'string' && over.id.startsWith('col-')) {
      targetStatus = over.id.slice(4) as LeadStatus
    }
    if (!targetStatus) {
      // dropped over a lead card — find which column that lead belongs to
      const overLead = leads.find((l) => l.id === String(over.id))
      if (overLead) targetStatus = overLead.status
    }

    if (!targetStatus || targetStatus === lead.status) return
    update.mutate({ id: leadId, status: targetStatus })
    toast.success(`Moved to ${statusLabel(targetStatus)}`)
  }

  const handleMove = (id: string, status: LeadStatus) => {
    if (id === '__new__') {
      openDrawer('lead-new')
      return
    }
    update.mutate({ id, status })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto scroll-area pb-2">
        {LEAD_STATUSES.map((s) => (
          <BoardColumn
            key={s.value}
            status={s}
            leads={grouped[s.value]}
            onMove={handleMove}
          />
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
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto scroll-area">
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/40">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40 rounded" />
                <Skeleton className="h-2.5 w-56 rounded" />
              </div>
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="size-7 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Header strip
// ----------------------------------------------------------------

function HeaderStrip({
  count,
  q,
  setQ,
  status,
  setStatus,
  source,
  setSource,
  owner,
  setOwner,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  status: string
  setStatus: (v: string) => void
  source: string
  setSource: (v: string) => void
  owner: string
  setOwner: (v: string) => void
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Leads</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">{count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 w-full md:w-[220px] text-[13px]"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="h-9 w-[130px] text-[12px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger size="sm" className="h-9 w-[130px] text-[12px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger size="sm" className="h-9 w-[130px] text-[12px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Button size="default" className="h-9" onClick={() => openDrawer('lead-new')}>
          <Plus className="size-4" /> New lead
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function LeadsView() {
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [source, setSource] = React.useState('all')
  const [owner, setOwner] = React.useState('all')
  const debouncedQ = useDebounced(q, 300)

  const { data: leads = [], isLoading } = useLeads(debouncedQ, status === 'all' ? undefined : status)
  const user = useAppStore((s) => s.user)

  const filtered = React.useMemo(() => {
    let list = leads
    if (source !== 'all') list = list.filter((l) => l.source === source)
    if (owner === 'me') list = list.filter((l) => l.ownerId === user?.id)
    else if (owner === 'unassigned') list = list.filter((l) => !l.ownerId)
    return list
  }, [leads, source, owner, user?.id])

  return (
    <div className="p-4 md:p-6 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        source={source}
        setSource={setSource}
        owner={owner}
        setOwner={setOwner}
      />

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="table" className="text-[12px] gap-1.5">
            <TableIcon className="size-3.5" /> Table
          </TabsTrigger>
          <TabsTrigger value="board" className="text-[12px] gap-1.5">
            <LayoutGrid className="size-3.5" /> Board
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {isLoading ? (
            <LeadsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-soft">
              <EmptyState
                icon={<UserPlus className="size-5" />}
                title="No leads yet"
                hint="Start capturing interest by creating your first lead. Add details, score it, and track progress through your pipeline."
                action={
                  <Button onClick={() => useAppStore.getState().openDrawer('lead-new')}>
                    <Plus className="size-4" /> New lead
                  </Button>
                }
              />
            </div>
          ) : (
            <LeadsTable leads={filtered} />
          )}
        </TabsContent>

        <TabsContent value="board">
          {isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {LEAD_STATUSES.map((s) => (
                <div key={s.value} className="min-w-[260px] w-[260px] bg-muted/40 rounded-xl border border-border/60 p-3 space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <LeadsBoard leads={filtered} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
