'use client'

/**
 * Pulse CRM — Contacts view
 *
 * Layout:
 *   ┌─ Header strip ────────────────────────────────────────┐
 *   │  Title + count badge │ search │ filters │ + New contact │
 *   ├─ Tabs ─────────────────────────────────────────────────┤
 *   │  Table | Cards                                          │
 *   │  • Table: TanStack Table w/ sortable cols + selection   │
 *   │  • Cards: responsive grid of premium contact cards      │
 *   └─────────────────────────────────────────────────────────┘
 */

import * as React from 'react'
import { useContacts, useContactMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  StatusDot,
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
import type { Contact } from '@/lib/types'
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
  Users,
  Tag as TagIcon,
  X,
  Mail,
  Phone,
  Building2,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
]

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
  return STATUSES.find((x) => x.value === s)?.label || s
}

// ----------------------------------------------------------------
// Card view
// ----------------------------------------------------------------

function ContactCard({ contact }: { contact: Contact }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const fullName = `${contact.firstName} ${contact.lastName}`.trim()
  return (
    <button
      onClick={() => openDrawer('contact', contact.id)}
      className="text-left card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft hover:-translate-y-px hover:shadow-glow transition-all w-full"
    >
      <div className="flex items-start gap-3">
        <Avatar name={fullName} url={contact.avatarUrl} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">{fullName}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {contact.jobTitle || '—'}
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-1.5">
          <StatusDot status={contact.status} />
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <Mail className="size-3 shrink-0" />
          <span className="truncate">{contact.email || 'No email'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3 shrink-0" />
          <span>{contact.phone || 'No phone'}</span>
        </div>
        {contact.company?.name && (
          <div className="flex items-center gap-1.5 text-muted-foreground truncate">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{contact.company.name}</span>
          </div>
        )}
      </div>
      {contact.tags && contact.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {contact.tags.slice(0, 4).map((t) => (
            <TagChip key={t.id} label={t.name} color={t.color} />
          ))}
          {contact.tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{contact.tags.length - 4}</span>
          )}
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
        Added {relTime(contact.createdAt)}
      </div>
    </button>
  )
}

// ----------------------------------------------------------------
// Table view
// ----------------------------------------------------------------

function ActionsCell({ contact }: { contact: Contact }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useContactMutations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 -mr-1" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDrawer('contact', contact.id)}>
          <Pencil className="size-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(contact.id)}>
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

const columns: ColumnDef<Contact>[] = [
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
    accessorFn: (r: Contact) => `${r.firstName} ${r.lastName}`,
    id: 'name',
    header: ({ column }: any) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }: any) => {
      const c = row.original as Contact
      const fullName = `${c.firstName} ${c.lastName}`.trim()
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={fullName} url={c.avatarUrl} size={28} />
          <span className="text-[13px] font-medium truncate">{fullName}</span>
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
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }: any) => (
      <span className="text-[12px] text-muted-foreground tabular-nums">{row.original.phone || '—'}</span>
    ),
  },
  {
    accessorKey: 'jobTitle',
    header: 'Job title',
    cell: ({ row }: any) => (
      <span className="text-[12px]">{row.original.jobTitle || '—'}</span>
    ),
  },
  {
    id: 'company',
    accessorFn: (r: Contact) => r.company?.name || '',
    header: 'Company',
    cell: ({ row }: any) => {
      const c = (row.original as Contact).company
      return c ? <span className="text-[12px]">{c.name}</span> : <span className="text-[12px] text-muted-foreground">—</span>
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
    cell: ({ row }: any) => <ActionsCell contact={row.original as Contact} />,
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

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useContactMutations()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data: contacts,
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
    toast.success(`${selectedCount} contact${selectedCount > 1 ? 's' : ''} deleted`)
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
                      icon={<Users className="size-5" />}
                      title="No contacts match your filters"
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
                    onClick={() => openDrawer('contact', row.original.id)}
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

function ContactsCards({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contacts.map((c) => (
        <ContactCard key={c.id} contact={c} />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function ContactsSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto scroll-area">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/40">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-2.5 w-48 rounded" />
            </div>
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
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
}: {
  count: number
  q: string
  setQ: (v: string) => void
  status: string
  setStatus: (v: string) => void
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Contacts</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">{count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 w-full md:w-[220px] text-[13px]"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="h-9 w-[140px] text-[12px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="default" className="h-9" onClick={() => openDrawer('contact-new')}>
          <Plus className="size-4" /> New contact
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function ContactsView() {
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const debouncedQ = useDebounced(q, 300)

  const { data: contacts = [], isLoading } = useContacts(debouncedQ)

  const filtered = React.useMemo(() => {
    if (status === 'all') return contacts
    return contacts.filter((c) => c.status === status)
  }, [contacts, status])

  return (
    <div className="p-4 md:p-6 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
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
            <ContactsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-soft">
              <EmptyState
                icon={<Users className="size-5" />}
                title="No contacts yet"
                hint="Add the people you work with — customers, partners, anyone you correspond with. Each contact can be linked to a company."
                action={
                  <Button onClick={() => useAppStore.getState().openDrawer('contact-new')}>
                    <Plus className="size-4" /> New contact
                  </Button>
                }
              />
            </div>
          ) : (
            <ContactsTable contacts={filtered} />
          )}
        </TabsContent>

        <TabsContent value="cards">
          {isLoading ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24 rounded" />
                      <Skeleton className="h-2.5 w-32 rounded" />
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
                icon={<Users className="size-5" />}
                title="No contacts match your filters"
                hint="Try adjusting the search query or status filter."
              />
            </div>
          ) : (
            <ContactsCards contacts={filtered} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
