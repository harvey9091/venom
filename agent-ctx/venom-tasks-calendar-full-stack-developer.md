# venom-tasks-calendar — full-stack-developer

## Task
Add a third "Calendar" tab to the Tasks view (`src/components/crm/views/tasks.tsx`) alongside Board + List. Monthly grid grouped by due date, with drag-to-reschedule, click-empty-cell-to-create, +N-more popover, past-due red border, today-column tint, and a no-due-date side panel.

## Files read (context)
- `worklog.md` — standard entry template + Venom CRM conventions (theme vars, MultiEdit-only, sonner/lucide).
- `src/lib/hooks.ts` — `useTasks()` → `Task[]`; `useTaskMutations()` → `{ create, update, remove }`; `create.mutate(payload, { onSuccess: (created) => ... })`.
- `src/lib/types.ts` — `Task.dueDate?: string | null`, `startDate?`, `priority: 'low'|'medium'|'high'|'urgent'`, `status`, `owner?`, `assignee?`.
- `src/lib/store.ts` — `useAppStore` exposes `openDrawer(type,id)`, `user`, `workspace`.
- `src/components/crm/views/tasks.tsx` (1011 lines pre-change) — Board (dnd-kit) + List (TanStack Table) tabs, `TasksSkeleton`, `TasksView` shell.
- `src/components/ui/popover.tsx` — Radix `Popover/PopoverTrigger/PopoverContent` available.
- `dev.log` — confirmed `Task` query includes `dueDate` + `startDate` columns.

## File edited
- `src/components/crm/views/tasks.tsx` — via `MultiEdit` (8 atomic edits, no rewrite).

## Edits applied
1. Added `Popover, PopoverTrigger, PopoverContent` import.
2. Added `Calendar as CalendarIcon`, `ChevronLeft`, `ChevronRight` to lucide imports.
3. Inserted `TasksCalendar` component (~410 lines) + constants (`CAL_WEEKDAYS`, `CAL_MONTHS`, `PRIORITY_CAL`) + helpers (`dayKey`, `gridStart`, `isSameDay`) before the Loading-skeleton section; widened `TasksSkeleton` signature to `'board' | 'list' | 'calendar'`.
4. Added calendar skeleton branch inside `TasksSkeleton`.
5. `view` state type → `'board' | 'list' | 'calendar'`.
6. Added Calendar `TabsTrigger`; updated `onValueChange` cast.
7. EmptyState guard: `filtered.length === 0 && view !== 'calendar'` (calendar renders even with 0 tasks so empty cells are clickable).
8. Render branch: added `view === 'calendar'` arm → `<TasksCalendar tasks={filtered} onSwitchToList={() => setView('list')} />`.

## Key implementation choices
- **Local-day grouping**: `dayKey(d)` uses `getFullYear/getMonth/getDate` (not UTC) to avoid off-by-one when the ISO dueDate is converted to a Date.
- **Grid start**: Monday of week containing day 1, via `(first.getDay() + 6) % 7`.
- **Drag-and-drop**: native HTML5 (`draggable` + `onDragStart/onDragOver/onDrop` + `dataTransfer`). No `@dnd-kit` in calendar (Board view keeps dnd-kit, untouched).
- **DueDate on create/reschedule**: noon-local ISO (`new Date(y,m,d,12,0,0).toISOString()`) — dodges DST edges, round-trips cleanly.
- **Priority colors**: `bg-{slate,blue,amber,rose}-500/15 text-{...}-600 dark:text-{...}-300` chips + solid `bg-{...}-500` dots for legend/popover.
- **Past-due**: `border-rose-500/70` on the chip (via `tailwind-merge` conditional, no `!important` needed).
- **Today's column**: `todayColIndex` computed only when today is in the visible 42-day grid (`days.findIndex`); weekday header + all 6 cells in that column get `bg-primary/8`/`bg-primary/5`.
- **Empty-cell create**: `onClick={() => dayTasks.length === 0 && createOnDay(d)}`; chips + popover trigger call `e.stopPropagation()`.
- **Compact cells**: `min-h-[100px] p-1.5`, `text-[10.5px]` chips.
- **No-due-date panel**: `xl:w-[280px]` aside, stacks below on `< xl`; shows up to 5 + "View all N" → `setView('list')`.

## Lint status
`bunx eslint src/components/crm/views/tasks.tsx` → **0 errors, 1 warning**. The warning (`react-hooks/incompatible-library` at line 671, `useReactTable`) is pre-existing in the List view's TanStack Table call — not introduced by this change.

## Dev server
Confirmed via `dev.log` that the Tasks API route returns tasks with `dueDate` + `startDate`; no compile errors after edits.
