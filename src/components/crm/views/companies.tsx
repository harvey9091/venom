'use client'

/**
 * Pulse CRM — Companies view
 *
 * Layout:
 *   ┌─ Header strip ────────────────────────────────────────┐
 *   │  Title + count badge │ search │ filters │ + New company │
 *   ├─ Tabs ─────────────────────────────────────────────────┤
 *   │  Table | Cards                                          │
 *   │  • Table: TanStack Table w/ sortable cols + selection   │
 *   │  • Cards: responsive grid of premium company cards      │
 *   └─────────────────────────────────────────────────────────┘
 */

import * as React from 'react'
import { useCompanies, useCompanyMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
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
  useReactTable,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Company, Contact } from '@/lib/types'
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
  Building2,
  Users,
  Tag as TagIcon,
  X,
  Globe,
  MapPin,
  DollarSign,
} from 'lucide-react'

// ----------------------------------------------------------------
// Local extended type — API includes contacts on Company but the
// shared type does not. We extend locally rather than modifying types.ts.
// ----------------------------------------------------------------

interface CompanyWithContacts extends Company {
  contacts?: Contact[]
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const SIZES = ['1-10', '11-50', '50-200', '200-500', '500-1000', '1000+']

const INDUSTRY_COLORS: Record<string, string> = {
  Technology: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  Finance: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  Healthcare: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'E-commerce': 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  Education: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  Manufacturing: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  default: 'bg-muted text-muted-foreground',
}

function industryClass(name?: string | null) {
  if (!name) return INDUSTRY_COLORS.default
  return INDUSTRY_COLORS[name] || INDUSTRY_COLORS.default
}

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'churned', label: 'Churned' },
]

function statusLabel(s: string) {
  return STATUSES.find((x) => x.value === s)?.label || s
}

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

function CompanyLogo({ name, size = 28 }: { name: string; size?: number }) {
  const initial = name?.[0]?.toUpperCase() || 'C'
  return (
    <div
      className="rounded-lg grid place-items-center bg-primary/10 text-primary font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  )
}

// ----------------------------------------------------------------
// Card view
// ----------------------------------------------------------------

function CompanyCard({ company }: { company: CompanyWithContacts }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const contactCount = company.contacts?.length || 0
  return (
    <button
      onClick={() => openDrawer('company', company.id)}
      className="text-left card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft hover:-translate-y-px hover:shadow-glow transition-all w-full"
    >
      <div className="flex items-start gap-3">
        <CompanyLogo name={company.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">{company.name}</div>
          {company.industry ? (
            <span className={cn('inline-flex items-center mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded', industryClass(company.industry))}>
              {company.industry}
            </span>
          ) : (
            <div className="text-[11px] text-muted-foreground">No industry</div>
          )}
        </div>
        <StatusDot status={company.status} />
      </div>
      <div className="mt-3 space-y-1.5 text-[11px]">
        {company.domain && (
          <div className="flex items-center gap-1.5 text-muted-foreground truncate">
            <Globe className="size-3 shrink-0" />
            <span className="truncate">{company.domain}</span>
          </div>
        )}
        {company.size && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3 shrink-0" />
            <span>{company.size} employees</span>
          </div>
        )}
        {(company.city || company.country) && (
          <div className="flex items-center gap-1.5 text-muted-foreground truncate">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{[company.city, company.country].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {typeof company.revenue === 'number' && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="size-3 shrink-0" />
            <span className="tabular-nums">{money(company.revenue)} revenue</span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{contactCount} contact{contactCount === 1 ? '' : 's'}</span>
        <span>Added {relTime(company.createdAt)}</span>
      </div>
    </button>
  )
}

// ----------------------------------------------------------------
// Table view
// ----------------------------------------------------------------

function ActionsCell({ company }: { company: Company }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useCompanyMutations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 -mr-1" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDrawer('company', company.id)}>
          <Pencil className="size-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(company.id)}>
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

const columns: ColumnDef<CompanyWithContacts>[] = [
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
    accessorKey: 'name',
    header: ({ column }: any) => <SortableHeader column={column}>Company</SortableHeader>,
    cell: ({ row }: any) => {
      const c = row.original as CompanyWithContacts
      return (
        <div className="flex items-center gap-2.5">
          <CompanyLogo name={c.name} size={28} />
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{c.name}</div>
            {c.industry && (
              <span className={cn('inline-flex items-center mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded', industryClass(c.industry))}>
                {c.industry}
              </span>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'domain',
    header: 'Domain',
    cell: ({ row }: any) => {
      const d = row.original.domain
      return d ? (
        <span className="text-[12px] text-muted-foreground">{d}</span>
      ) : (
        <span className="text-[12px] text-muted-foreground">—</span>
      )
    },
  },
  {
    accessorKey: 'size',
    header: 'Size',
    cell: ({ row }: any) => {
      const s = row.original.size
      return s ? (
        <span className="text-[12px] tabular-nums">{s}</span>
      ) : (
        <span className="text-[12px] text-muted-foreground">—</span>
      )
    },
  },
  {
    accessorKey: 'revenue',
    header: ({ column }: any) => <SortableHeader column={column}>Revenue</SortableHeader>,
    cell: ({ row }: any) => {
      const v = row.original.revenue
      return v != null ? (
        <span className="text-[12px] tabular-nums font-medium">{money(v)}</span>
      ) : (
        <span className="text-[12px] text-muted-foreground">—</span>
      )
    },
  },
  {
    id: 'contactsCount',
    accessorFn: (r: CompanyWithContacts) => r.contacts?.length || 0,
    header: ({ column }: any) => <SortableHeader column={column}>Contacts</SortableHeader>,
    cell: ({ row }: any) => {
      const n = (row.original as CompanyWithContacts).contacts?.length || 0
      return (
        <Badge variant="secondary" className="text-[10px] tabular-nums">{n}</Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => {
      const s = row.original.status
      return (
        <div className="inline-flex items-center gap-1.5">
          <StatusDot status={s} />
          <span className="text-[12px]">{statusLabel(s)}</span>
        </div>
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
    cell: ({ row }: any) => <ActionsCell company={row.original as Company} />,
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
      <span className="text-[12px] font-medium">{selectedCount} selected</span>
      <div className="h-4 w-px bg-border mx-1" />
      <Button size="sm" variant="ghost" className="h-7 text-[12px]" onClick={() => toast.info('Bulk assign — coming soon')}>
        <Users className="size-3.5" /> Assign
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

function CompaniesTable({ companies }: { companies: CompanyWithContacts[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useCompanyMutations()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data: companies,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const handleBulkDelete = () => {
    selectedRows.forEach((r) => remove.mutate(r.original.id))
    setRowSelection({})
    toast.success(`${selectedCount} compan${selectedCount > 1 ? 'ies' : 'y'} deleted`)
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
                      icon={<Building2 className="size-5" />}
                      title="No companies match your filters"
                      hint="Try adjusting the search query or status filter."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="cursor-pointer border-border/40"
                    onClick={() => openDrawer('company', row.original.id)}
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

function CompaniesCards({ companies }: { companies: CompanyWithContacts[] }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {companies.map((c) => (
        <CompanyCard key={c.id} company={c} />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function CompaniesSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto scroll-area">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/40">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-7 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-2.5 w-20 rounded" />
            </div>
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="size-7 rounded" />
          </div>
        ))}
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
  industry,
  setIndustry,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  status: string
  setStatus: (v: string) => void
  industry: string
  setIndustry: (v: string) => void
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Companies</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">{count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search companies…"
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
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger size="sm" className="h-9 w-[140px] text-[12px]">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {Object.keys(INDUSTRY_COLORS).filter((k) => k !== 'default').map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="default" className="h-9" onClick={() => openDrawer('company-new')}>
          <Plus className="size-4" /> New company
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function CompaniesView() {
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [industry, setIndustry] = React.useState('all')
  const debouncedQ = useDebounced(q, 300)

  const { data: companies = [], isLoading } = useCompanies(debouncedQ)
  const typed = companies as CompanyWithContacts[]

  const filtered = React.useMemo(() => {
    let list = typed
    if (status !== 'all') list = list.filter((c) => c.status === status)
    if (industry !== 'all') list = list.filter((c) => c.industry === industry)
    return list
  }, [typed, status, industry])

  return (
    <div className="p-4 md:p-6 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        industry={industry}
        setIndustry={setIndustry}
      />

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="table" className="text-[12px] gap-1.5">
            <TableIcon className="size-3.5" /> Table
          </TabsTrigger>
          <TabsTrigger value="cards" className="text-[12px] gap-1.5">
            <LayoutGrid className="size-3.5" /> Cards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {isLoading ? (
            <CompaniesSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-soft">
              <EmptyState
                icon={<Building2 className="size-5" />}
                title="No companies yet"
                hint="Track the organizations you sell to. Add a company to group contacts, deals, and notes in one place."
                action={
                  <Button onClick={() => useAppStore.getState().openDrawer('company-new')}>
                    <Plus className="size-4" /> New company
                  </Button>
                }
              />
            </div>
          ) : (
            <CompaniesTable companies={filtered} />
          )}
        </TabsContent>

        <TabsContent value="cards">
          {isLoading ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28 rounded" />
                      <Skeleton className="h-2.5 w-20 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-soft">
              <EmptyState
                icon={<Building2 className="size-5" />}
                title="No companies match your filters"
                hint="Try adjusting the search query or status filter."
              />
            </div>
          ) : (
            <CompaniesCards companies={filtered} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
