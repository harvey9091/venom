'use client'

/**
 * Pulse CRM — TaskDrawer
 *
 * Rendered inside the global Sheet slide-over (see
 * `src/components/crm/shell/entity-drawer.tsx`). Layout:
 *
 *   ┌─ Header (inline-editable title, priority pill) ────────────┐
 *   ├─ Tabs: Details | Subtasks | Comments ──────────────────────┤
 *   │  Details: title, description, status, priority, assignee,   │
 *   │           owner, dueDate, startDate, recurrence, dealId     │
 *   │  Subtasks: list w/ toggle done + delete, add-subtask composer│
 *   │  Comments: list w/ avatar + body + relTime, composer         │
 *   ├─ Footer (Delete | Cancel | Save) ──────────────────────────┤
 *
 * - Create mode → starts blank, Save creates a task and closes drawer.
 * - Edit mode → pre-filled, Save updates + toast, drawer stays open.
 * - Comments: appended via PATCH `/api/crm/tasks` with nested create.
 *   If the API rejects the nested write, we keep the comment locally
 *   and show a "Comment saving…" badge — no separate endpoint created.
 */

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTasks, useTaskMutations, useDeals, useSettings } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  PriorityPill,
  relTime,
  EmptyState,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { Task, TaskStatus, TaskPriority, Membership, Comment as CommentType } from '@/lib/types'
import {
  Trash2,
  Save,
  Plus,
  CalendarClock,
  Calendar as CalendarIcon,
  Pencil,
  Check,
  X,
  Send,
  ListTodo,
  MessageSquare,
  AlignLeft,
  GripVertical,
  Loader2,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
]

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const RECURRENCES = ['none', 'daily', 'weekly', 'monthly']

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

interface FormState {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  ownerId: string | null
  dueDate: string | null
  startDate: string | null
  recurrence: string
  dealId: string | null
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: null,
  ownerId: null,
  dueDate: null,
  startDate: null,
  recurrence: 'none',
  dealId: null,
}

function taskToForm(t: Task): FormState {
  return {
    title: t.title || '',
    description: t.description || '',
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId ?? null,
    ownerId: t.ownerId ?? null,
    dueDate: t.dueDate ?? null,
    startDate: t.startDate ?? null,
    recurrence: t.recurrence || 'none',
    dealId: t.dealId ?? null,
  }
}

// ----------------------------------------------------------------
// Date picker button
// ----------------------------------------------------------------

function DatePickerButton({
  value,
  onChange,
  placeholder = 'Pick a date',
}: {
  value: string | null
  onChange: (v: string | null) => void
  placeholder?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full justify-start text-[12px] font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="size-3.5 mr-1.5" />
          {value ? format(new Date(value), 'MMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(d) => onChange(d ? d.toISOString() : null)}
          initialFocus
        />
        {value && (
          <div className="border-t border-border p-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function TaskDrawer({
  id,
  mode,
  onClose,
}: {
  id?: string
  mode?: 'create'
  onClose: () => void
}) {
  const isCreate = mode === 'create' || !id
  const { data: tasks = [], isLoading } = useTasks()
  const task = id ? tasks.find((t) => t.id === id) : undefined

  const { create, update, remove } = useTaskMutations()
  const { data: deals = [] } = useDeals()
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []
  const user = useAppStore((s) => s.user)

  const [tab, setTab] = React.useState<'details' | 'subtasks' | 'comments'>('details')
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState('')

  // Sync form to fetched task (only when switching tasks or first load).
  React.useEffect(() => {
    if (task) setForm(taskToForm(task))
    else if (isCreate) setForm(EMPTY_FORM)
  }, [task?.id, isCreate])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // ----- Save / Create -----
  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    const payload: Partial<Task> = {
      title: form.title.trim(),
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId,
      ownerId: form.ownerId,
      dueDate: form.dueDate,
      startDate: form.startDate,
      recurrence: form.recurrence === 'none' ? null : form.recurrence,
      dealId: form.dealId,
    }
    if (isCreate) {
      create.mutate(
        {
          ...payload,
          creatorId: user?.id,
          ownerId: payload.ownerId || user?.id,
          order: 0,
        } as any,
        {
          onSuccess: () => {
            toast.success('Task created')
            onClose()
          },
          onError: () => toast.error('Could not create task'),
        }
      )
    } else if (id) {
      update.mutate(
        { id, ...payload } as any,
        {
          onSuccess: () => toast.success('Task saved'),
          onError: () => toast.error('Could not save task'),
        }
      )
    }
  }

  // ----- Inline title edit -----
  const commitTitle = () => {
    const v = titleDraft.trim()
    if (!v) {
      setEditingTitle(false)
      return
    }
    setForm((f) => ({ ...f, title: v }))
    if (!isCreate && id && task && v !== task.title) {
      update.mutate({ id, title: v } as any)
    }
    setEditingTitle(false)
  }

  const startEditTitle = () => {
    setTitleDraft(form.title)
    setEditingTitle(true)
  }

  // ----- Delete -----
  const handleDelete = () => {
    if (!id) return
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('Task deleted')
        onClose()
      },
    })
  }

  const titleDisplay = isCreate ? 'New task' : form.title || 'Untitled task'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <ListTodo className="size-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            {editingTitle && !isCreate ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  className="h-7 text-[15px] font-semibold"
                />
                <Button size="icon" variant="ghost" className="size-7" onClick={commitTitle} aria-label="Save title">
                  <Check className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setEditingTitle(false)}
                  aria-label="Cancel title edit"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => !isCreate && startEditTitle()}
                  className="text-[15px] font-semibold tracking-tight truncate text-left"
                >
                  {titleDisplay}
                </button>
                {!isCreate && (
                  <button
                    type="button"
                    onClick={startEditTitle}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                    aria-label="Edit title"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="text-[12px] text-muted-foreground truncate mt-0.5">
              {isCreate
                ? 'Create a new task'
                : task?.assignee
                  ? `Assigned to ${task.assignee.name}`
                  : 'Unassigned'}
            </div>
            {!isCreate && (
              <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                <PriorityPill priority={form.priority} />
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-[10px] uppercase tracking-wide">{form.status.replace('_', ' ')}</span>
                </span>
                {form.dueDate && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarClock className="size-3" />
                    {format(new Date(form.dueDate), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-border/60 bg-background sticky top-0 z-10">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="bg-transparent p-0 h-9 gap-4">
            <TabsTrigger
              value="details"
              className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <AlignLeft className="size-3.5 mr-1.5" /> Details
            </TabsTrigger>
            <TabsTrigger
              value="subtasks"
              className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <ListTodo className="size-3.5 mr-1.5" /> Subtasks
              {task?.subtasks && task.subtasks.length > 0 && (
                <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {task.subtasks.filter((s) => s.status === 'done').length}/{task.subtasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <MessageSquare className="size-3.5 mr-1.5" /> Comments
              {task?.comments && task.comments.length > 0 && (
                <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {task.comments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-5 overflow-y-auto scroll-area">
        {isLoading && !isCreate ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-20 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
          </div>
        ) : tab === 'details' ? (
          <DetailsTab form={form} setField={setField} members={members} deals={deals} />
        ) : tab === 'subtasks' ? (
          <SubtasksTab task={task} isCreate={isCreate} />
        ) : (
          <CommentsTab task={task} isCreate={isCreate} currentUserId={user?.id} />
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between gap-2">
        {!isCreate && id ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={remove.isPending}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isCreate ? 'Create' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Details tab
// ----------------------------------------------------------------

function DetailsTab({
  form,
  setField,
  members,
  deals,
}: {
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  members: Membership[]
  deals: any[]
}) {
  return (
    <div className="space-y-4">
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Task details
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-title" className="text-[12px]">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="e.g. Prepare Q3 proposal"
            className="h-9 text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-desc" className="text-[12px]">
            Description
          </Label>
          <Textarea
            id="task-desc"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Add context, acceptance criteria, links…"
            className="min-h-[90px] text-[13px] resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Status</Label>
            <Select value={form.status} onValueChange={(v) => setField('status', v as TaskStatus)}>
              <SelectTrigger className="h-9 text-[12px] w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setField('priority', v as TaskPriority)}
            >
              <SelectTrigger className="h-9 text-[12px] w-full">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Schedule
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Due date</Label>
            <DatePickerButton
              value={form.dueDate}
              onChange={(v) => setField('dueDate', v)}
              placeholder="No due date"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Start date</Label>
            <DatePickerButton
              value={form.startDate}
              onChange={(v) => setField('startDate', v)}
              placeholder="No start date"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Recurrence</Label>
          <Select value={form.recurrence} onValueChange={(v) => setField('recurrence', v)}>
            <SelectTrigger className="h-9 text-[12px] w-full">
              <SelectValue placeholder="Repeat" />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r === 'none' ? 'Does not repeat' : r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ownership
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Assignee</Label>
            <Select
              value={form.assigneeId || 'unassigned'}
              onValueChange={(v) => setField('assigneeId', v === 'unassigned' ? null : v)}
            >
              <SelectTrigger className="h-9 text-[12px] w-full">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.user?.name || m.user?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Owner</Label>
            <Select
              value={form.ownerId || 'unassigned'}
              onValueChange={(v) => setField('ownerId', v === 'unassigned' ? null : v)}
            >
              <SelectTrigger className="h-9 text-[12px] w-full">
                <SelectValue placeholder="Set owner…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.user?.name || m.user?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Related deal</Label>
          <Select
            value={form.dealId || 'none'}
            onValueChange={(v) => setField('dealId', v === 'none' ? null : v)}
          >
            <SelectTrigger className="h-9 text-[12px] w-full">
              <SelectValue placeholder="Link to deal…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {deals.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Subtasks tab
// ----------------------------------------------------------------

function SubtasksTab({ task, isCreate }: { task?: Task; isCreate: boolean }) {
  const { create, update, remove } = useTaskMutations()
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)
  const [draft, setDraft] = React.useState('')

  if (isCreate) {
    return (
      <EmptyState
        icon={<ListTodo className="size-5" />}
        title="Save the task first"
        hint="Subtasks can be added once this task has been created."
      />
    )
  }

  const subtasks = task?.subtasks || []

  const handleAdd = () => {
    const v = draft.trim()
    if (!v || !task) return
    create.mutate(
      {
        workspaceId: workspace?.id,
        parentTaskId: task.id,
        title: v,
        status: 'todo',
        priority: 'medium',
        ownerId: user?.id,
        creatorId: user?.id,
        order: subtasks.length,
      } as any,
      {
        onSuccess: () => {
          setDraft('')
          toast.success('Subtask added')
        },
        onError: () => toast.error('Could not add subtask'),
      }
    )
  }

  const toggleSubtask = (s: Task) => {
    const newStatus: TaskStatus = s.status === 'done' ? 'todo' : 'done'
    update.mutate({ id: s.id, status: newStatus } as any)
  }

  return (
    <div className="space-y-3">
      {subtasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="size-5" />}
          title="No subtasks"
          hint="Break this task into smaller steps. Check the box on each subtask when it's done."
        />
      ) : (
        <ol className="space-y-1.5">
          {subtasks.map((s) => {
            const done = s.status === 'done'
            return (
              <li
                key={s.id}
                className="card-premium bg-card border border-border/60 rounded-lg p-2.5 shadow-soft flex items-center gap-2.5 group"
              >
                <Checkbox checked={done} onCheckedChange={() => toggleSubtask(s)} aria-label="Toggle subtask" />
                <GripVertical className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors shrink-0" />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-[12.5px] truncate',
                      done && 'line-through text-muted-foreground'
                    )}
                  >
                    {s.title}
                  </div>
                  {s.assignee && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {s.assignee.name}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(s.id)}
                  aria-label="Delete subtask"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            )
          })}
        </ol>
      )}

      {/* Add-subtask inline composer */}
      <div className="card-premium bg-card border border-border/60 rounded-lg p-2.5 shadow-soft flex items-center gap-2">
        <Plus className="size-4 text-muted-foreground shrink-0" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Add a subtask…"
          className="h-7 text-[12px] border-0 shadow-none focus-visible:ring-0 px-0"
        />
        {draft.trim() && (
          <Button size="sm" className="h-7 text-[11px]" onClick={handleAdd} disabled={create.isPending}>
            Add
          </Button>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Comments tab
// ----------------------------------------------------------------

interface PendingComment extends CommentType {
  _pending?: boolean
}

function CommentsTab({
  task,
  isCreate,
  currentUserId,
}: {
  task?: Task
  isCreate: boolean
  currentUserId?: string
}) {
  const user = useAppStore((s) => s.user)
  const queryClient = useQueryClient()
  const [body, setBody] = React.useState('')
  const [pending, setPending] = React.useState<PendingComment[]>([])

  if (isCreate) {
    return (
      <EmptyState
        icon={<MessageSquare className="size-5" />}
        title="Save the task first"
        hint="Comments can be added once this task has been created."
      />
    )
  }

  const existingComments: CommentType[] = task?.comments || []
  const allComments: PendingComment[] = [...existingComments, ...pending]

  const handleSend = async () => {
    const v = body.trim()
    if (!v || !task) return

    // Optimistically append locally so the user sees instant feedback.
    const optimistic: PendingComment = {
      id: `pending-${Date.now()}`,
      taskId: task.id,
      authorId: currentUserId || 'me',
      body: v,
      createdAt: new Date().toISOString(),
      author: user
        ? { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl || null }
        : null,
      _pending: true,
    }
    setPending((p) => [...p, optimistic])
    setBody('')

    try {
      // PATCH the task with a nested create on the comments relation.
      const r = await fetch('/api/crm/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          comments: { create: [{ authorId: currentUserId, body: v }] },
        }),
      })
      if (!r.ok) throw new Error('Failed to add comment')
      // Drop the optimistic placeholder; the next query refetch will surface the real comment.
      setPending((p) => p.filter((c) => c.id !== optimistic.id))
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (err) {
      // Leave the placeholder so the user sees "Comment saving…" and can retry.
      toast.error('Comment could not be saved — keeping locally')
    }
  }

  return (
    <div className="space-y-3">
      {allComments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-5" />}
          title="No comments yet"
          hint="Share updates, ask questions, or @mention teammates to keep the conversation in context."
        />
      ) : (
        <ol className="space-y-2">
          {allComments.map((c) => (
            <li
              key={c.id}
              className={cn(
                'card-premium bg-card border border-border/60 rounded-lg p-3 shadow-soft',
                c._pending && 'opacity-70 border-dashed'
              )}
            >
              <div className="flex items-center gap-2">
                {c.author ? (
                  <Avatar name={c.author.name} url={c.author.avatarUrl} size={22} />
                ) : (
                  <div className="size-5 rounded-full bg-muted" />
                )}
                <span className="text-[12px] font-medium">{c.author?.name || 'Someone'}</span>
                <span className="text-[11px] text-muted-foreground">{relTime(c.createdAt)}</span>
                {c._pending && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                    <Loader2 className="size-3 animate-spin" /> Comment saving…
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[12.5px] text-foreground/80 whitespace-pre-wrap pl-7">
                {c.body}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Composer */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-3 shadow-soft space-y-2">
        <div className="flex items-start gap-2.5">
          {user ? <Avatar name={user.name} url={user.avatarUrl} size={26} /> : null}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Write a comment…  (⌘+Enter to send)"
            className="min-h-[64px] text-[13px] resize-none border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>
        <div className="flex justify-end pt-2 border-t border-border/60">
          <Button size="sm" onClick={handleSend} disabled={!body.trim()}>
            <Send className="size-3.5" /> Send
          </Button>
        </div>
      </div>
    </div>
  )
}
