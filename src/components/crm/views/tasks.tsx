'use client'

/**
 * Pulse CRM — Tasks view
 *
 * Layout:
 *   ┌─ Header strip ─────────────────────────────────────────────┐
 *   │  Title + count │ search │ status filter │ priority filter   │
 *   │  assignee filter │ + New task                                │
 *   ├─ Tabs: Board | List ───────────────────────────────────────┤
 *   │  Board: 4-column Kanban (todo | in_progress | done | canceled)
 *   │         • dnd-kit drag between columns                     │
 *   │         • card: priority pill + title + due date (red if  │
 *   │           past) + assignee avatar + subtask count + tags   │
 *   │                                                            │
 *   │  List: TanStack Table                                      │
 *   │         • checkbox, title, status (StatusDot), priority    │
 *   │           (PriorityPill), assignee (Avatar), due date,     │
 *   │           subtasks count, tags, actions (Edit/Delete)      │
 *   └────────────────────────────────────────────────────────────┘
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTasks, useTaskMutations, useSettings } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  StatusDot,
  PriorityPill,
  relTime,
  EmptyState,
  TagChip,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { Task, TaskStatus, TaskPriority, Membership, Tag } from '@/lib/types'
import {
  Plus,
  Search,
  ListTodo,
  KanbanSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  CircleSlash,
  Circle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const COLUMNS: { status: TaskStatus; label: string; dotClass: string }[] = [
  { status: 'todo', label: 'To do', dotClass: 'bg-slate-400' },
  { status: 'in_progress', label: 'In Progress', dotClass: 'bg-blue-500' },
  { status: 'done', label: 'Done', dotClass: 'bg-emerald-500' },
  { status: 'canceled', label: 'Canceled', dotClass: 'bg-rose-500' },
]

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In Progress',
  done: 'Done',
  canceled: 'Canceled',
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

/** Defensive tag-name extractor (handles both Tag[] and join-row shapes). */
function tagName(t: unknown): string {
  if (typeof t === 'string') return t
  const obj = t as { name?: string; tag?: { name?: string } }
  return obj?.name || obj?.tag?.name || 'tag'
}

function tagColor(t: unknown): string {
  if (typeof t === 'object' && t !== null) {
    const obj = t as { color?: string; tag?: { color?: string } }
    return obj?.color || obj?.tag?.color || '#64748b'
  }
  return '#64748b'
}

/** Count completed subtasks (e.g. "2/3"). */
function subtaskProgress(task: Task): { done: number; total: number } | null {
  if (!task.subtasks || task.subtasks.length === 0) return null
  const total = task.subtasks.length
  const done = task.subtasks.filter((s) => s.status === 'done').length
  return { done, total }
}

function isPast(date?: string | null): boolean {
  if (!date) return false
  return new Date(date).getTime() < Date.now()
}

// ----------------------------------------------------------------
// Draggable task card (board)
// ----------------------------------------------------------------

function TaskCard({ task, isOverlay }: { task: Task; isOverlay?: boolean }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-xl border border-dashed border-border/40 bg-muted/20 h-[96px]"
        aria-hidden
      />
    )
  }

  const past = isPast(task.dueDate)
  const progress = subtaskProgress(task)
  const tags = task.tags || ([] as Tag[])

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={!isOverlay ? style : undefined}
      className={cn(
        'group card-premium bg-card border border-border p-3 shadow-soft',
        'rounded-xl hover:shadow-premium hover:-translate-y-0.5 transition-all',
        'cursor-grab active:cursor-grabbing select-none',
        isOverlay && 'rotate-2 scale-105 shadow-premium ring-2 ring-primary/40'
      )}
      onClick={() => !isOverlay && openDrawer('task', task.id)}
      {...(!isOverlay ? attributes : {})}
      {...(!isOverlay ? listeners : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <PriorityPill priority={task.priority} />
        <GripVertical className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors shrink-0" />
      </div>
      <div className="mt-1.5 text-[13px] font-medium leading-snug line-clamp-2">
        {task.title}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        {task.dueDate ? (
          <span
            className={cn(
              'inline-flex items-center gap-1',
              past && task.status !== 'done' && 'text-rose-600 dark:text-rose-400 font-medium'
            )}
          >
            <CalendarClock className="size-3" />
            {relTime(task.dueDate)}
          </span>
        ) : (
          <span className="text-muted-foreground/60">No due date</span>
        )}
        {progress && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <CheckCircle2 className="size-3" />
            {progress.done}/{progress.total} subtasks
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t, i) => (
            <TagChip key={i} label={tagName(t)} color={tagColor(t)} />
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-end">
        {task.assignee ? (
          <Avatar name={task.assignee.name} url={task.assignee.avatarUrl} size={20} />
        ) : task.owner ? (
          <Avatar name={task.owner.name} url={task.owner.avatarUrl} size={20} />
        ) : null}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Droppable column body
// ----------------------------------------------------------------

function ColumnBody({
  status,
  children,
}: {
  status: TaskStatus
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${status}`,
    data: { type: 'column', status },
  })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 p-2 space-y-2 overflow-y-auto scroll-area',
        'max-h-[calc(100vh-280px)] min-h-[160px] rounded-b-xl transition-colors',
        isOver && 'bg-primary/5'
      )}
    >
      {children}
    </div>
  )
}

// ----------------------------------------------------------------
// Status column
// ----------------------------------------------------------------

function StatusColumn({
  status,
  label,
  dotClass,
  tasks,
  index,
}: {
  status: TaskStatus
  label: string
  dotClass: string
  tasks: Task[]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      className="w-[300px] shrink-0 bg-muted/30 rounded-xl p-2 flex flex-col border border-border/60"
    >
      <div className="px-2 pt-1.5 pb-2 flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotClass)} />
        <span className="text-[12px] font-semibold">{label}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground bg-background px-1.5 py-0.5 rounded ml-auto">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ColumnBody status={status}>
          {tasks.length === 0 && (
            <div className="h-24 rounded-lg border border-dashed border-border/50 grid place-items-center text-[11px] text-muted-foreground">
              Drop tasks here
            </div>
          )}
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </ColumnBody>
      </SortableContext>
    </motion.div>
  )
}

// ----------------------------------------------------------------
// Kanban board (DnD)
// ----------------------------------------------------------------

function TasksBoard({ tasks }: { tasks: Task[] }) {
  const { update } = useTaskMutations()
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [localTasks, setLocalTasks] = React.useState<Task[]>(tasks)

  React.useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const grouped = React.useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [], canceled: [] }
    localTasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t)
    })
    return map
  }, [localTasks])

  const activeTask = activeId ? localTasks.find((t) => t.id === activeId) : null

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const dragged = localTasks.find((t) => t.id === activeId)
    if (!dragged) return

    // Determine target status — column droppable carries `status`, cards carry their own.
    let targetStatus: TaskStatus | undefined
    const overData = over.data.current as { type?: string; status?: TaskStatus } | undefined
    if (overData?.type === 'column' && overData.status) {
      targetStatus = overData.status
    } else {
      // Dropped on a card → use that card's status
      const overCard = localTasks.find((t) => t.id === String(over.id))
      targetStatus = overCard?.status
    }

    if (!targetStatus) return

    if (targetStatus === dragged.status) {
      // Same-column reorder — local only
      const col = grouped[dragged.status]
      const fromIdx = col.findIndex((t) => t.id === dragged.id)
      const toIdx = col.findIndex((t) => t.id === String(over.id))
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
      const reordered = arrayMove(col, fromIdx, toIdx)
      const others = localTasks.filter((t) => t.status !== dragged.status)
      setLocalTasks([...others, ...reordered])
      return
    }

    // Cross-column → optimistic local update + API mutate
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === dragged.id ? { ...t, status: targetStatus! } : t))
    )
    update.mutate(
      { id: dragged.id, status: targetStatus },
      {
        onSuccess: () => toast.success(`Moved to ${STATUS_LABELS[targetStatus!]}`),
        onError: () => {
          // revert on failure
          setLocalTasks((prev) =>
            prev.map((t) => (t.id === dragged.id ? { ...t, status: dragged.status } : t))
          )
          toast.error('Could not move task')
        },
      }
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto scroll-area pb-2">
        {COLUMNS.map((c, i) => (
          <StatusColumn
            key={c.status}
            status={c.status}
            label={c.label}
            dotClass={c.dotClass}
            tasks={grouped[c.status]}
            index={i}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// ----------------------------------------------------------------
// List view — TanStack Table
// ----------------------------------------------------------------

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <StatusDot status={status} />
      <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
    </span>
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

function ActionsCell({ task }: { task: Task }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useTaskMutations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 -mr-1"
          onClick={(e) => e.stopPropagation()}
          aria-label="Task actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDrawer('task', task.id)}>
          <Pencil className="size-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(task.id)}>
          <Trash2 className="size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useTaskColumns(): ColumnDef<Task>[] {
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
        header: ({ column }: any) => <SortableHeader column={column}>Task</SortableHeader>,
        cell: ({ row }: any) => {
          const t = row.original as Task
          return (
            <div className="flex items-start gap-2 min-w-[220px]">
              <PriorityPill priority={t.priority} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">{t.title}</div>
                {t.description && (
                  <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                    {t.description}
                  </div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (r: Task) => r.status,
        header: 'Status',
        cell: ({ row }: any) => <StatusBadge status={(row.original as Task).status} />,
      },
      {
        accessorKey: 'priority',
        header: ({ column }: any) => <SortableHeader column={column}>Priority</SortableHeader>,
        cell: ({ row }: any) => <PriorityPill priority={(row.original as Task).priority} />,
      },
      {
        id: 'assignee',
        accessorFn: (r: Task) => r.assignee?.name || r.owner?.name || '',
        header: 'Assignee',
        cell: ({ row }: any) => {
          const t = row.original as Task
          const a = t.assignee || t.owner
          return a ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={a.name} url={a.avatarUrl} size={22} />
              <span className="text-[12px]">{a.name.split(' ')[0]}</span>
            </div>
          ) : (
            <span className="text-[12px] text-muted-foreground">Unassigned</span>
          )
        },
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }: any) => <SortableHeader column={column}>Due</SortableHeader>,
        cell: ({ row }: any) => {
          const t = row.original as Task
          if (!t.dueDate) return <span className="text-[12px] text-muted-foreground">—</span>
          const past = isPast(t.dueDate) && t.status !== 'done'
          return (
            <span
              className={cn(
                'text-[11px] inline-flex items-center gap-1',
                past ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground'
              )}
            >
              <CalendarClock className="size-3" />
              {relTime(t.dueDate)}
            </span>
          )
        },
      },
      {
        id: 'subtasks',
        header: 'Subtasks',
        enableSorting: false,
        cell: ({ row }: any) => {
          const t = row.original as Task
          const p = subtaskProgress(t)
          if (!p) return <span className="text-[12px] text-muted-foreground">—</span>
          return (
            <span className="text-[11px] tabular-nums text-muted-foreground inline-flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              {p.done}/{p.total}
            </span>
          )
        },
      },
      {
        id: 'tags',
        header: 'Tags',
        enableSorting: false,
        cell: ({ row }: any) => {
          const t = row.original as Task
          const tags = t.tags || ([] as Tag[])
          if (tags.length === 0) return <span className="text-[12px] text-muted-foreground">—</span>
          return (
            <div className="flex flex-wrap gap-1 max-w-[180px]">
              {tags.slice(0, 2).map((tag, i) => (
                <TagChip key={i} label={tagName(tag)} color={tagColor(tag)} />
              ))}
              {tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        size: 48,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }: any) => <ActionsCell task={row.original as Task} />,
      },
    ],
    []
  )
}

function TasksTable({ tasks }: { tasks: Task[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useTaskMutations()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'dueDate', desc: false }])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const columns = useTaskColumns()
  const table = useReactTable({
    data: tasks,
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
    toast.success(`${selectedCount} task${selectedCount > 1 ? 's' : ''} deleted`)
  }

  return (
    <div>
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-primary/8 border border-primary/20 shadow-soft">
          <span className="text-[12px] font-medium">{selectedCount} selected</span>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[12px] text-destructive hover:text-destructive"
            onClick={handleBulkDelete}
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setRowSelection({})}
            aria-label="Clear selection"
          >
            <span className="text-[14px]">×</span>
          </Button>
        </div>
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
                      icon={<ListTodo className="size-5" />}
                      title="No tasks match your filters"
                      hint="Try adjusting the search query or filters."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="cursor-pointer border-border/40 group transition-colors hover:bg-muted/40"
                    onClick={() => openDrawer('task', row.original.id)}
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

function TasksSkeleton({ view }: { view: 'board' | 'list' }) {
  if (view === 'board') {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((c) => (
          <div
            key={c.status}
            className="w-[300px] shrink-0 bg-muted/30 rounded-xl p-2 flex flex-col border border-border/60"
          >
            <div className="px-2 pt-1.5 pb-2 flex items-center gap-2">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-4 w-6 rounded ml-auto" />
            </div>
            <div className="space-y-2 p-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[96px] w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto scroll-area">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3 border-b border-border/40"
          >
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-48 rounded" />
              <Skeleton className="h-2.5 w-64 rounded" />
            </div>
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3 w-20 rounded" />
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
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  assigneeFilter,
  setAssigneeFilter,
  members,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  priorityFilter: string
  setPriorityFilter: (v: string) => void
  assigneeFilter: string
  setAssigneeFilter: (v: string) => void
  members: Membership[]
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Tasks</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">
          {count}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 w-full md:w-[200px] text-[13px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="h-9 w-[130px] text-[12px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger size="sm" className="h-9 w-[120px] text-[12px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger size="sm" className="h-9 w-[140px] text-[12px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.user?.name || m.user?.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="default" className="h-9" onClick={() => openDrawer('task-new')}>
          <Plus className="size-4" /> New task
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function TasksView() {
  const [q, setQ] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [priorityFilter, setPriorityFilter] = React.useState('all')
  const [assigneeFilter, setAssigneeFilter] = React.useState('all')
  const [view, setView] = React.useState<'board' | 'list'>('board')
  const debouncedQ = useDebounced(q, 300)

  const { data: tasks = [], isLoading } = useTasks()
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []

  const filtered = React.useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase()
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (assigneeFilter === 'unassigned' && (t.assigneeId || t.ownerId)) return false
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned') {
        if (t.assigneeId !== assigneeFilter && t.ownerId !== assigneeFilter) return false
      }
      if (needle) {
        const hay = (t.title + ' ' + (t.description || '')).toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [tasks, debouncedQ, statusFilter, priorityFilter, assigneeFilter])

  return (
    <div className="p-4 md:p-6 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
        members={members}
      />

      <div className="mb-3">
        <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'list')}>
          <TabsList className="bg-transparent p-0 h-9 gap-1">
            <TabsTrigger
              value="board"
              className="text-[12px] data-[state=active]:bg-muted data-[state=active]:shadow-none gap-1.5"
            >
              <KanbanSquare className="size-3.5" /> Board
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="text-[12px] data-[state=active]:bg-muted data-[state=active]:shadow-none gap-1.5"
            >
              <ListTodo className="size-3.5" /> List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <TasksSkeleton view={view} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<ListTodo className="size-5" />}
            title={
              q || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all'
                ? 'No tasks match your filters'
                : 'No tasks yet'
            }
            hint={
              q || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all'
                ? 'Try adjusting the search query or filters.'
                : 'Create your first task to start tracking work. Assign owners, set due dates, and break it down into subtasks.'
            }
            action={
              !q &&
              statusFilter === 'all' &&
              priorityFilter === 'all' &&
              assigneeFilter === 'all' ? (
                <Button onClick={() => useAppStore.getState().openDrawer('task-new')}>
                  <Plus className="size-4" /> New task
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === 'board' ? (
        <TasksBoard tasks={filtered} />
      ) : (
        <TasksTable tasks={filtered} />
      )}
    </div>
  )
}
