'use client'

/**
 * Pulse CRM — Deals view (table)
 *
 * Layout:
 *   ┌─ Header strip ───────────────────────────────────────────┐
 *   │  Title + count badge │ search │ pipeline filter │ + New deal │
 *   ├─ Bulk toolbar (only when rows are selected) ─────────────┤
 *   ├─ TanStack Table ─────────────────────────────────────────┤
 *   │  • select  • title (company avatar)  • amount (money)     │
 *   │  • stage (colored pill)  • probability (% + mini bar)      │
 *   │  • owner (Avatar)  • expectedClose (relTime, red if past)  │
 *   │  • createdAt (relTime)  • actions (Edit/Delete)            │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Row click → openDrawer('deal', id). Search is debounced 300ms.
 */

import * as React from 'react'
import { useDeals, useDealMutations, usePipelines } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  money,
  relTime,
  EmptyState,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Deal, Pipeline, Stage } from '@/lib/types'
import {
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  DollarSign,
  Users as UsersIcon,
  X,
} from 'lucide-react'

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

/** Find the Stage object across all pipelines by stageId. */
function findStage(pipelines: Pipeline[], stageId?: string | null): Stage | undefined {
  if (!stageId) return undefined
  for (const p of pipelines) {
    const s = p.stages.find((st) => st.id === stageId)
    if (s) return s
  }
  return undefined
}

/** Render a colored stage pill using the stage's hex color. */
function StagePill({ stage }: { stage?: Stage }) {
  if (!stage) return <span className="text-[12px] text-muted-foreground">—</span>
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full"
      style={{
        background: `${stage.color}22`,
        color: stage.color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
      {stage.name}
    </span>
  )
}

/** Mini progress bar + percentage for deal probability. */
function ProbabilityCell({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const color = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${v}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{v}%</span>
    </div>
  )
}

// ----------------------------------------------------------------
// Table view
// ----------------------------------------------------------------

function ActionsCell({ deal }: { deal: Deal }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useDealMutations()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 -mr-1"
          onClick={(e) => e.stopPropagation()}
          aria-label="Deal actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDrawer('deal', deal.id)}>
          <Pencil className="size-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => remove.mutate(deal.id)}
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

function useDealColumns(pipelines: Pipeline[]): ColumnDef<Deal>[] {
  return React.useMemo(
    () => [
      {
        id: 'select',
        size: 32,
        header: ({ table }: any) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
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
        accessorKey: 'title',
        header: ({ column }: any) => <SortableHeader column={column}>Deal</SortableHeader>,
        cell: ({ row }: any) => {
          const d = row.original as Deal
          const companyName = d.company?.name
          return (
            <div className="flex items-center gap-2.5 min-w-[180px]">
              <Avatar
                name={companyName || d.title}
                url={d.company?.logoUrl}
                size={28}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">{d.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {companyName || d.contact?.firstName + ' ' + d.contact?.lastName || '—'}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'amount',
        header: ({ column }: any) => <SortableHeader column={column}>Amount</SortableHeader>,
        cell: ({ row }: any) => {
          const d = row.original as Deal
          return (
            <span className="text-[12px] tabular-nums font-medium">
              {money(d.amount || 0, d.currency || 'INR')}
            </span>
          )
        },
      },
      {
        id: 'stage',
        accessorFn: (r: Deal) => r.stage?.name || findStage(pipelines, r.stageId)?.name || '',
        header: 'Stage',
        cell: ({ row }: any) => {
          const d = row.original as Deal
          const stage = d.stage || findStage(pipelines, d.stageId)
          return <StagePill stage={stage} />
        },
      },
      {
        accessorKey: 'probability',
        header: ({ column }: any) => <SortableHeader column={column}>Prob.</SortableHeader>,
        cell: ({ row }: any) => <ProbabilityCell value={row.original.probability} />,
      },
      {
        id: 'owner',
        accessorFn: (r: Deal) => r.owner?.name || '',
        header: 'Owner',
        cell: ({ row }: any) => {
          const o = (row.original as Deal).owner
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
        accessorKey: 'expectedClose',
        header: ({ column }: any) => <SortableHeader column={column}>Expected close</SortableHeader>,
        cell: ({ row }: any) => {
          const d = row.original as Deal
          if (!d.expectedClose) return <span className="text-[12px] text-muted-foreground">—</span>
          const date = new Date(d.expectedClose)
          const isPast = date.getTime() < Date.now()
          return (
            <span className={cn('text-[11px]', isPast ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground')}>
              {relTime(d.expectedClose)}
            </span>
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
        cell: ({ row }: any) => <ActionsCell deal={row.original as Deal} />,
      },
    ],
    [pipelines]
  )
}

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
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[12px]"
        onClick={() => toast.info('Bulk assign — coming soon')}
      >
        <UsersIcon className="size-3.5" /> Assign
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[12px] text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" /> Delete
      </Button>
      <div className="flex-1" />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

function DealsTable({ deals, pipelines }: { deals: Deal[]; pipelines: Pipeline[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useDealMutations()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const columns = useDealColumns(pipelines)

  const table = useReactTable({
    data: deals,
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
    toast.success(`${selectedCount} deal${selectedCount > 1 ? 's' : ''} deleted`)
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
                      icon={<DollarSign className="size-5" />}
                      title="No deals match your filters"
                      hint="Try adjusting the search query or pipeline filter."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="cursor-pointer border-border/40 group transition-colors hover:bg-muted/40"
                    onClick={() => openDrawer('deal', row.original.id)}
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
// Loading skeleton
// ----------------------------------------------------------------

function DealsSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto scroll-area">
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-3 border-b border-border/40"
            >
              <Skeleton className="size-4 rounded" />
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40 rounded" />
                <Skeleton className="h-2.5 w-56 rounded" />
              </div>
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="size-7 rounded-full" />
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
  pipelineId,
  setPipelineId,
  pipelines,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  pipelineId: string
  setPipelineId: (v: string) => void
  pipelines: Pipeline[]
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Deals</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">{count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search deals…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 w-full md:w-[220px] text-[13px]"
          />
        </div>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger size="sm" className="h-9 w-[160px] text-[12px]">
            <SelectValue placeholder="All pipelines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pipelines</SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="default" className="h-9" onClick={() => openDrawer('deal-new')}>
          <Plus className="size-4" /> New deal
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function DealsView() {
  const [q, setQ] = React.useState('')
  const [pipelineId, setPipelineId] = React.useState('all')
  const debouncedQ = useDebounced(q, 300)

  // Fetch all pipelines so we can render stage pills for every deal.
  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelines() as {
    data: Pipeline[]
    isLoading: boolean
  }

  // Fetch deals for the selected pipeline (or all if "all").
  const { data: deals = [], isLoading: dealsLoading } = useDeals(
    pipelineId === 'all' ? undefined : pipelineId
  )

  // Filter by search query (client-side on title + company + contact).
  const filtered = React.useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase()
    if (!needle) return deals
    return deals.filter((d) => {
      const contactName = d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : ''
      return (
        d.title.toLowerCase().includes(needle) ||
        (d.company?.name || '').toLowerCase().includes(needle) ||
        contactName.toLowerCase().includes(needle)
      )
    })
  }, [deals, debouncedQ])

  const isLoading = dealsLoading || pipelinesLoading

  return (
    <div className="p-4 md:p-6 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        pipelineId={pipelineId}
        setPipelineId={setPipelineId}
        pipelines={pipelines}
      />

      {isLoading ? (
        <DealsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<DollarSign className="size-5" />}
            title={q || pipelineId !== 'all' ? 'No deals match your filters' : 'No deals yet'}
            hint={
              q || pipelineId !== 'all'
                ? 'Try adjusting the search query or pipeline filter.'
                : 'Deals are created automatically when you set an estimated value on a lead. You can also create one manually.'
            }
            action={
              !q && pipelineId === 'all' ? (
                <Button onClick={() => useAppStore.getState().openDrawer('deal-new')}>
                  <Plus className="size-4" /> Create Deal
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <DealsTable deals={filtered} pipelines={pipelines} />
      )}
    </div>
  )
}
