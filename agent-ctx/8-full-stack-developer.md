# Task 8 — full-stack-developer — Tasks view, Task Drawer, Calendar view

## What was built

Three `'use client'` files under `/home/z/my-project/src/components/crm/views/`:

| File | Export | LOC | Purpose |
|---|---|---|---|
| `tasks.tsx` | `TasksView` | ~770 | Tasks list — Board (Kanban by status w/ dnd-kit) + List (TanStack Table) |
| `task-drawer.tsx` | `TaskDrawer` | ~930 | Slide-over drawer: Details / Subtasks / Comments tabs |
| `calendar.tsx` | `CalendarView` | ~1420 | Calendar — Day / Week / Month / Agenda + drag-to-create + drag-to-move |

## Architecture decisions

### TasksView (Board + List)

- **Header strip pattern** (mirrors DealsView): `Tasks` title + count `Badge` on the left; debounced (300ms) search `Input` + 3 filter `Select`s (status, priority, assignee from `useSettings('members')` cast to `Membership[]`) + primary `New task` `Button` (`openDrawer('task-new')`) on the right.
- **Tabs**: `bg-transparent` `TabsList` with `data-[state=active]:bg-muted` segmented control — Board | List.
- **Board view** (4 columns `todo | in_progress | done | canceled`, each `w-[300px] shrink-0 bg-muted/30 rounded-xl p-2 flex flex-col border border-border/60`):
  - **Status column header**: colored dot (`bg-slate-400` / `bg-blue-500` / `bg-emerald-500` / `bg-rose-500` matching `shared.tsx`'s `StatusDot`), label, count `Badge`.
  - **Task card** (`useSortable`): `PriorityPill` + `GripVertical` (hover-revealed), title (2-line clamp), due date row (`CalendarClock` + `relTime`, rose if past & status≠done), subtask progress (`CheckCircle2` + `{done}/{total} subtasks`), tags (`TagChip` row, max 3 with `+N` overflow), assignee/owner `Avatar` bottom-right. `cursor-grab active:cursor-grabbing`, `hover:-translate-y-0.5 hover:shadow-premium`.
  - **DragOverlay** shows the active card with `rotate-2 scale-105 shadow-premium ring-2 ring-primary/40` (same convention as Pipeline Kanban).
  - **Drop logic**: `PointerSensor` (6px activation) + `KeyboardSensor` + `closestCorners`. Cross-column → optimistic local state update + `useTaskMutations().update.mutate({ id, status: newStatus })`, toasts `Moved to {label}`, reverts on error. Same-column reorder → `arrayMove` on local state only (no API call).
- **List view** — TanStack Table v8 with columns: select (`Checkbox`), title (`PriorityPill` + title + description), status (`StatusBadge` = `StatusDot` + label), priority (`PriorityPill`), assignee (`Avatar` + first name), due date (`relTime`, rose if past), subtasks count, tags, actions (⋮ Edit/Delete). `SortableHeader` w/ ArrowUp/Down/UpDown. Sticky `TableHeader` w/ `bg-card/95 backdrop-blur`. Row click → `openDrawer('task', id)`. Bulk-toolbar appears with bulk Delete.
- **Empty state + loading skeleton**: 8-row skeleton for list; 4-column skeleton for board (3 cards per column).

### TaskDrawer (slide-over)

- **Render context**: rendered inside the existing `SheetContent` from `entity-drawer.tsx`. Uses `pr-12` on the header to leave room for the Sheet's built-in X button — exactly the same convention as Task 7's DealDrawer (and Task 6's LeadDrawer).
- **Header**: 36px `ListTodo` icon tile on `bg-primary/10 text-primary`. **Inline-editable title** — in edit mode, clicking the title turns it into an `Input` (`autoFocus`, Enter commits via `update.mutate({ id, title })`, Escape cancels). A `Pencil` icon appears on hover. Subtitle: `Assigned to {name}` or `Unassigned`. Chip row: `PriorityPill`, status text, due date (`CalendarClock` + `format(d, 'MMM d, yyyy')`).
- **Tabs** (Details | Subtasks | Comments) — sticky `top-0` with `data-[state=active]:border-primary` bottom-border underline indicator. Subtasks/Comments `TabsTrigger` shows a count `Badge` (`{done}/{total}` for subtasks, plain count for comments).
- **Details tab** — local `FormState` (no react-hook-form, simpler since we don't need validation beyond title-required). 3 `card-premium` sub-cards:
  1. **Task details**: title `Input` (required), description `Textarea`, status `Select` (4 statuses), priority `Select` (4 priorities).
  2. **Schedule**: due date picker (`Popover` + `Button` showing `format(date, 'MMM d, yyyy')` from date-fns + shadcn `Calendar` w/ "Clear date" footer), start date picker (same pattern), recurrence `Select` (none/daily/weekly/monthly).
  3. **Ownership**: assignee `Select` + owner `Select` (both from `useSettings('members')` cast to `Membership[]`), related deal `Select` (from `useDeals()`).
- **Subtasks tab**: `EmptyState` ("Save the task first") in create mode. Otherwise a list of `task.subtasks`, each row = `Checkbox` (toggles `done`/`todo` via `update.mutate({ id, status })`) + `GripVertical` + title (line-through if done) + assignee name + Delete button (hover-revealed). Inline composer at bottom: `Input` + "Add" button → `useTaskMutations().create.mutate({ workspaceId, parentTaskId: task.id, title, status: 'todo', priority: 'medium', ownerId: user.id, creatorId: user.id, order: subtasks.length })`.
- **Comments tab**: `EmptyState` ("Save the task first") in create mode. Otherwise a list of `task.comments` (each: `Avatar` + name + `relTime` + body, with `_pending` comments showing an amber "Comment saving…" `Loader2` badge) + composer card at the bottom (`Textarea` + `Send` button, ⌘+Enter to send). Sending does an **optimistic local append** then a `PATCH /api/crm/tasks` with `{ id, comments: { create: [{ authorId, body }] } }` (Prisma nested write). On success, drops the optimistic placeholder and `useQueryClient().invalidateQueries({ queryKey: ['tasks'] })`. On failure, leaves the placeholder so the user sees "Comment saving…" and can retry. **NO new endpoint created** — uses the existing task PATCH.
- **Footer** (sticky `bottom-0 bg-background/95 backdrop-blur border-t border-border p-4`): Delete (destructive ghost, edit mode only) on the left; Cancel + Save/Create (primary, with `Loader2` spinner when pending) on the right.

### CalendarView (Day / Week / Month / Agenda)

- **Header**: `Calendar` title + Today `Badge` (when current date is today) on the left; segmented navigation (prev / Today / next) + segmented view switcher (Day / Week / Month / Agenda) on the right.
- **Sub-header**: current range label (`EEEE, MMMM d, yyyy` for Day; `MMM d – d, yyyy` for Week; `MMMM yyyy` for Month; `Upcoming events` for Agenda).
- **Layout**: `grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4` — side panel (mini calendar + legend) on the left, active view on the right. Side panel hides on `< lg`.
- **Mini calendar side panel**: shadcn `Calendar` (react-day-picker v9) in single-select mode. Days that have events get a `hasEvents` modifier that renders a small `bg-primary` dot under the day number. Clicking a day jumps to it (and switches Month → Day view).
- **Legend**: lists all 5 event types with their `--chart-N` color dots.
- **Week view** (default): 7-column grid (60px time-label gutter + 7 day columns). Day headers: `EEE` + `d` (today gets `bg-primary text-primary-foreground` pill). Today's column tinted `bg-primary/5`. Time grid: 24 hour rows × 56px each. Events rendered as absolutely-positioned `EventBlock`s (top = `timeToY(start)`, height = `durationToHeight(start, end)`). Each block: `rounded-lg shadow-soft hover:scale-[1.02] hover:shadow-premium`, `--chart-N` background by type, title + time range + location/meeting-link icon. **Now indicator**: red horizontal line + dot at `timeToY(now)` on today's column, auto-refreshes every 60s.
- **Drag-to-create** (per spec's mouse-event suggestion): `onMouseDown` on empty space starts a window-level `mousemove`/`mouseup` listener. Drag distance < 15 min → create a default 1-hour event at the click position. Drag ≥ 15 min → use `[startY, endY]` as the time range. Both paths round to nearest 15 min, then open a `QuickCreatePopover` (title `Input` + type `Select` + Create button) anchored at the click position. Save calls `useCalendarMutations().create.mutate({ workspaceId, title, type, startAt, endAt, allDay: false })`.
- **Drag-to-move** (HTML5 native drag — keeps the calendar grid simple, no nested dnd context): event block has `draggable`, `onDragStart` sets `dataTransfer` with the event id. Day column has `onDragOver={e.preventDefault()}` + `onDrop` computes the new start time from the drop Y position (rounded to 15 min), preserves duration, and calls `useCalendarMutations().update.mutate({ id, startAt: newStart, endAt: newEnd })`. Toasts "Event moved".
- **Click event**: opens an `EventDetailsPopover` (color dot + title + type, time + location + meeting link, description, Edit + Delete buttons). Edit opens an `EditEventDialog` modal (title `Input`, type `Select`, start/end `datetime-local` Inputs, Save changes). Delete calls `remove.mutate(event.id)`.
- **Day view**: single 24-hour column for the selected day, larger event blocks, same drag-to-create/move + click-to-detail as Week view.
- **Month view**: standard 6×7 month grid (Sun start). Each cell: day number (today gets `bg-primary text-primary-foreground` pill) + up to 3 event chips (`text-white` on `--chart-N` background) + `+N more` overflow. Out-of-month days are dimmed. Click a day → switches to Day view for that date.
- **Agenda view**: vertical list of the next 30 days, grouped by day (only days with events shown). Each event row: color dot, title, time range, location/meeting-link. Click → opens the same `EventDetailsPopover`.
- **Framer Motion**: `AnimatePresence mode="wait"` wraps the active view; on view change or date change, the panel fades + slides (`opacity:0, y:6` → `opacity:1, y:0`, exit `y:-6`). `transition={{ duration: 0.18 }}`.

## Public API

```ts
// src/components/crm/views/tasks.tsx
export function TasksView(): JSX.Element

// src/components/crm/views/task-drawer.tsx
export function TaskDrawer({ id?, mode?, onClose }: {
  id?: string
  mode?: 'create'
  onClose: () => void
}): JSX.Element

// src/components/crm/views/calendar.tsx
export function CalendarView(): JSX.Element
```

## Interactions wired up

| Trigger | Action | Store / hook call |
|---|---|---|
| Tasks header `New task` button | open create drawer | `openDrawer('task-new')` |
| Tasks board card click | open edit drawer | `openDrawer('task', id)` |
| Tasks board cross-column drag | change status | `useTaskMutations().update.mutate({ id, status })` |
| Tasks board same-column drag | visual reorder only | `arrayMove` on local state, no API call |
| Tasks list row click | open edit drawer | `openDrawer('task', id)` |
| Tasks list actions menu → Edit | open edit drawer | `openDrawer('task', id)` |
| Tasks list actions menu → Delete | delete task | `useTaskMutations().remove.mutate(id)` |
| Tasks list bulk toolbar → Delete | delete all selected | `remove.mutate(id)` per row, then clear selection |
| TaskDrawer title inline-edit | update title | `useTaskMutations().update.mutate({ id, title })` |
| TaskDrawer Save (create) | create + close | `create.mutate(payload, { onSuccess: onClose })` |
| TaskDrawer Save (edit) | update + toast | `update.mutate({ id, ...payload }, { onSuccess: toast })` |
| TaskDrawer Delete | delete + close | `remove.mutate(id, { onSuccess: onClose })` |
| TaskDrawer Subtasks → toggle | update subtask status | `useTaskMutations().update.mutate({ id, status: 'done'|'todo' })` |
| TaskDrawer Subtasks → Add | create subtask | `useTaskMutations().create.mutate({ workspaceId, parentTaskId, title, status: 'todo', priority: 'medium', ownerId, creatorId, order })` |
| TaskDrawer Subtasks → Delete | delete subtask | `useTaskMutations().remove.mutate(subtask.id)` |
| TaskDrawer Comments → Send | append comment via nested write | `PATCH /api/crm/tasks { id, comments: { create: [{ authorId, body }] } }` |
| Calendar prev/next/today | change `currentDate` | local state |
| Calendar view switcher | change `view` (Day/Week/Month/Agenda) | local state |
| Calendar drag-to-create | open quick-create popover → create event | `useCalendarMutations().create.mutate({ workspaceId, title, type, startAt, endAt, allDay: false })` |
| Calendar drag-to-move | update event start/end | `useCalendarMutations().update.mutate({ id, startAt, endAt })` |
| Calendar event click | open details popover | local state |
| Calendar event → Edit | open edit dialog → save | `useCalendarMutations().update.mutate({ id, title, type, startAt, endAt })` |
| Calendar event → Delete | delete event | `useCalendarMutations().remove.mutate(event.id)` |
| Calendar Month day click | switch to Day view for that date | local state |
| Calendar mini-cal day click | jump to date (and switch Month → Day) | local state |

## Lint status

`bunx eslint src/components/crm/views/tasks.tsx src/components/crm/views/task-drawer.tsx src/components/crm/views/calendar.tsx`

 **0 errors, 1 warning**. The warning is the same benign React-Compiler informational notice (`react-hooks/incompatible-library`) about `useReactTable()` in `tasks.tsx` that Task 7 reported for `deals.tsx` — the React Compiler gracefully skips memoizing the table component. `tsc --noEmit` confirms zero type errors in any of the 3 new files (the pre-existing tsc errors are all in OTHER files: API routes with Prisma include mismatches, and the not-yet-built views that `page.tsx` and `entity-drawer.tsx` import).

## Files touched

- Created: `src/components/crm/views/tasks.tsx`
- Created: `src/components/crm/views/task-drawer.tsx`
- Created: `src/components/crm/views/calendar.tsx`
- Modified: `worklog.md` (appended Task 8 entry)
- Modified: none other

## Hand-off notes for downstream agents

- The Tasks Kanban cross-column drop calls `useTaskMutations().update.mutate({ id, status })`. The tasks API route at `/api/crm/tasks/route.ts` is a plain `db.task.update({ where: { id }, data: patch })`, so any Prisma-valid field can be patched (including `parentTaskId` for re-parenting, `tags` for tagging, `comments: { create: [...] }` for nested comment creation).
- The TaskDrawer's comment composer uses `useQueryClient().invalidateQueries({ queryKey: ['tasks'] })` after a successful comment PATCH, so the new comment appears as soon as the refetch resolves. The optimistic placeholder is dropped on success but kept on failure (with an amber "Comment saving…" badge) so the user knows to retry.
- The Calendar drag-to-create computes the time from the y-offset of the day column's `getBoundingClientRect()`. If you change `HOUR_HEIGHT` (currently 56px), the math auto-adjusts (minutes-per-px = 60/HOUR_HEIGHT). The minimum drag distance to create an event is `HOUR_HEIGHT / 4` (15 min) — smaller than that, a click creates a default 1-hour event starting at the click position.
- The Calendar drag-to-move preserves the event's duration when moving it to a new time slot. To support cross-day drags (e.g. drag a Tuesday event to Thursday), the `DayColumn` `onDrop` already receives the target `day` so the new start is computed on the correct date — but currently drag-to-move only works within the same Week/Day view (because each `DayColumn` listens for drops). To enable cross-week drags, you'd need to lift the drop handler to the parent grid.
- The Calendar's "Edit" dialog uses native `<input type="datetime-local">` for the start/end times — this gives the user a precise datetime picker (vs. the date-only shadcn Calendar). The `toLocalInput` helper formats a `Date` into the `yyyy-MM-ddTHH:mm` format the input expects, in local time.
- The Mini calendar side panel uses shadcn `Calendar` (react-day-picker v9) with a custom `hasEvents` modifier to show a small `bg-primary` dot under days that have events. If you want a different indicator style, change the `modifiersClassNames.hasEvents` class.
- The TaskDrawer's inline title edit calls `update.mutate({ id, title })` immediately on Enter (no Save button click needed). This is the same pattern as the DealDrawer's inline title edit. If you want a confirm step, wrap the mutate in a debounced save or add a "Save title" affordance.
- The `useSettings('members')` hook returns `unknown` — I cast to `Membership[]` locally in both `tasks.tsx` (for the assignee filter dropdown) and `task-drawer.tsx` (for the assignee/owner selects). Reuse this pattern rather than modifying the shared hook.
- The `useTasks()` hook fetches tasks where `parentTaskId: null` (top-level tasks only) — the tasks API route filters this server-side. Subtasks come back as `task.subtasks` on each top-level task. So my TasksView shows only top-level tasks in the Kanban/Table; subtasks are visible in the TaskDrawer's Subtasks tab. If you want subtasks to appear as their own cards/rows, you'd need to add a `useAllTasks()` hook that doesn't filter by `parentTaskId`.
