# Task 7 — full-stack-developer — Deals view, Pipeline Kanban view, Deal Drawer

## What was built

Three `'use client'` files under `/home/z/my-project/src/components/crm/views/`:

| File | Export | LOC | Purpose |
|---|---|---|---|
| `deals.tsx` | `DealsView` | ~530 | Deal list — TanStack Table w/ sortable cols + bulk actions |
| `pipeline.tsx` | `PipelineView` | ~540 | Pipeline Kanban — dnd-kit board + forecasting panel + add stage |
| `deal-drawer.tsx` | `DealDrawer` | ~660 | Slide-over drawer: Overview / Activity / Tasks / Notes tabs |

## Architecture decisions

### DealsView (table)

- **Header strip pattern** (mirrors LeadsView): title + count `Badge` on the left; debounced (300ms) search `Input` + pipeline `Select` filter + primary `New deal` `Button` on the right.
- **TanStack Table v8** (`getCoreRowModel` + `getSortedRowModel` + `getFilteredRowModel`). Custom `SortableHeader` primitive (ArrowUp/ArrowDown/ArrowUpDown icons). Sticky `TableHeader` with `bg-card/95 backdrop-blur`. Soft hover via `hover:bg-muted/40`. Row click → `openDrawer('deal', id)`.
- **Columns**: select (Checkbox), title (company Avatar + title + subtitle), amount (money, tabular-nums, font-medium), stage (colored `StagePill` from `stage.color` with leading color dot), probability (mini progress bar + %), owner (Avatar + first name), expectedClose (relTime, rose if past), createdAt (relTime), actions (⋮ menu Edit/Delete).
- **Bulk toolbar**: "X selected" + Assign (toasts "coming soon" per spec) + Delete (mutates per row, clears selection, success toast) + Clear (X icon).
- **Stage resolution**: helper `findStage(pipelines, stageId)` searches all pipelines as a fallback when `deal.stage` isn't populated.
- **Loading**: 8-row shimmering `Skeleton`.
- **Empty state**: `EmptyState` with `DollarSign` icon, different copy for "no deals match filters" vs "no deals yet" (with CTA button).

### PipelineView (Kanban)

- **Pipeline selector**: `usePipelines()` cast to `Pipeline[]` (the hook returns `unknown`). `selectedPipelineId` defaults to the `isDefault` pipeline (or first) via `useEffect`.
- **Kanban board** (horizontal scroll of stage columns, each `w-[300px] shrink-0 bg-muted/30 rounded-xl p-2 flex flex-col`):
  - **Stage column**: header (color dot from `stage.color`, name, count `Badge`, total value), body is a `useDroppable` container (so empty columns accept drops, highlights `bg-primary/5` when hovered).
  - **Deal card** (`useSortable`): title, company Avatar + name, big amount (16px font-semibold tabular-nums), owner Avatar, probability bar (color-coded emerald/amber/slate), expected close date with `CalendarClock` icon. Card uses the exact className tokens from the spec.
  - **DragOverlay**: when dragging, original card renders as a dashed placeholder; the overlay shows a clone with `rotate-2 scale-105 shadow-premium ring-2 ring-primary/40` per spec ("rotate slightly + scale up").
  - **Sensors**: `PointerSensor` (6px activation) + `KeyboardSensor` (accessible) + `closestCorners` collision detection.
  - **Drop logic**:
    - Cross-column → optimistic local state update + `useDealMutations().update.mutate({ id, stageId: newStageId, probability: newStage.probability })`. Toasts "Moved to {stage}".
    - Same-column reorder → `arrayMove` on local state only, no API call (per spec).
  - **Local ordering state** (`localDeals`): synced to query result via `useEffect`, but reordered locally so dnd doesn't trigger refetches mid-drag.
- **Add stage**: `+` tile at the end of the columns row (also `w-[300px] shrink-0`, dashed border). Click expands into an `AddStageCard` form: name `Input`, 8-color swatch picker, probability range slider, `Add stage` button. Enter saves, Escape cancels. Save calls `usePipelineMutations().update.mutate({ id, stages: [...existing, newStage] })`.
- **Framer Motion entrance**: each stage column animates `initial={{opacity:0, y:8}} animate={{opacity:1, y:0}}` staggered by `index * 0.04`.
- **Forecasting panel** (4-column responsive grid below the Kanban):
  1. Total pipeline (sum of open deal amounts + count)
  2. Weighted (sum of `amount × probability / 100` + % of total)
  3. Win rate (`won / (won + lost) × 100`, uses both `deal.closeReason` and `stage.isWon/isLost`)
  4. By stage — horizontal stacked bar (each segment colored with `stage.color`, sized proportionally) + wrap legend.

### DealDrawer (slide-over)

- **Render context**: rendered inside the existing `SheetContent` from `entity-drawer.tsx`. The Sheet provides `overflow-y-auto` + `sm:max-w-[640px]` + a built-in `SheetPrimitive.Close` X button at `top-4 right-4`. My drawer uses `pr-12` on the header to leave room for that X — so the user sees exactly one close button (per the established convention from Task 6's LeadDrawer/ContactDrawer/CompanyDrawer).
- **Header**: 40px icon tile (`CircleDollarSign` on `bg-primary/10 text-primary`). **Inline-editable title** — in edit mode, clicking the title turns it into an `Input` (`autoFocus`, Enter commits via `update.mutate({ id, title })`, Escape cancels). A `Pencil` icon appears on hover. Subtitle: company name or contact name. In edit mode: row of chips — colored stage badge (built from `selectedStage.color`), amount (money), probability %, and `closeReason` `Badge` (green for won, red for lost).
- **Tabs** (Overview | Activity | Tasks | Notes) — sticky `top-0` with `data-[state=active]:border-primary` bottom-border underline indicator (matches established drawer pattern).
- **Overview tab** — `react-hook-form` + `zod` schema. Form split into 3 `card-premium` sub-cards:
  1. **Deal details**: title `Input`, amount `Input` + currency `Select` (6 currencies), live money preview, probability `Slider` (0-100).
  2. **Pipeline & stage**: pipeline `Select` + stage `Select` (color dot prefix on each item), expected close date picker (`Popover` + `Calendar` + "Clear date" button), close reason `Select` (Open/Won/Lost) **disabled unless selected stage has `isWon` or `isLost`**.
  3. **Ownership & links**: owner `Select` (from `useSettings('members')` cast to `Membership[]`), company `Select`, contact `Select`.
- **Reactive form logic** (in `useEffect`s):
  - When pipeline changes, if current stage isn't in new pipeline's stages, reset `stageId` to new pipeline's first stage and update probability.
  - In create mode, when stage changes, auto-set probability to stage's default probability.
  - When chosen stage is no longer won/lost, clear `closeReason`.
  - On submit, if a won/lost stage is selected but `closeReason` is null, auto-fill it.
- **Activity tab**: vertical timeline (same pattern as LeadDrawer) filtered by `dealId`.
- **Tasks tab**: list of tasks where `dealId === deal.id`, each a clickable card → `openDrawer('task', t.id)`. "Add task" button calls `useTaskMutations().create.mutate({ workspaceId, dealId, title: 'New task', status: 'todo', priority: 'medium', ownerId: user.id, creatorId: user.id })` then on success opens the task drawer via `openDrawer('task', task.id)`. In create mode (no deal id), shows "Save the deal first" empty state.
- **Notes tab**: composer (`Textarea` + Add note button) calling `useNoteMutations().create.mutate({ dealId, body, pinned: false })`, plus list of existing notes filtered by `dealId`. Loading skeletons + empty state.
- **Footer** (sticky `bottom-0`): Delete (destructive ghost, edit mode only, `remove.mutate(id)` then `onClose()`) on the left; Cancel + Save/Create (primary) on the right. Create mode → `onClose()` after success. Edit mode → toast and stay open.

## Public API

```ts
// src/components/crm/views/deals.tsx
export function DealsView(): JSX.Element

// src/components/crm/views/pipeline.tsx
export function PipelineView(): JSX.Element

// src/components/crm/views/deal-drawer.tsx
export function DealDrawer({ id?, mode?, onClose }: {
  id?: string
  mode?: 'create'
  onClose: () => void
}): JSX.Element
```

## Interactions wired up

| Trigger | Action | Store / hook call |
|---|---|---|
| Header `New deal` button | open create drawer | `openDrawer('deal-new')` |
| Table row click | open edit drawer | `openDrawer('deal', id)` |
| Row actions menu → Edit | open edit drawer | `openDrawer('deal', id)` |
| Row actions menu → Delete | delete deal | `useDealMutations().remove.mutate(id)` |
| Bulk toolbar → Delete | delete all selected | `remove.mutate(id)` per row, then clear selection |
| Bulk toolbar → Assign | toast | `toast.info('Bulk assign — coming soon')` |
| Kanban card click | open edit drawer | `openDrawer('deal', id)` |
| Kanban card cross-column drag | change stage + probability | `useDealMutations().update.mutate({ id, stageId, probability })` |
| Kanban card same-column drag | visual reorder only | `arrayMove` on local state, no API call |
| "Add stage" → Save | add stage to pipeline | `usePipelineMutations().update.mutate({ id, stages: [...existing, new] })` |
| Drawer Save (create) | create + close | `create.mutate(payload, { onSuccess: onClose })` |
| Drawer Save (edit) | update + toast | `update.mutate({ id, ...payload }, { onSuccess: toast })` |
| Drawer title inline-edit | update title | `update.mutate({ id, title })` |
| Drawer Delete | delete + close | `remove.mutate(id, { onSuccess: onClose })` |
| Drawer Tasks → Add task | create task + open task drawer | `useTaskMutations().create.mutate(...)` then `openDrawer('task', task.id)` |
| Drawer Notes → Add note | create note | `useNoteMutations().create.mutate({ dealId, body, pinned: false })` |

## Lint status

`bunx eslint src/components/crm/views/deals.tsx src/components/crm/views/pipeline.tsx src/components/crm/views/deal-drawer.tsx`

→ **0 errors, 2 warnings**. Both warnings are benign React-Compiler informational notices (`react-hooks/incompatible-library`) about `useReactTable()` in `deals.tsx` and `form.watch()` in `deal-drawer.tsx` — the React Compiler gracefully skips memoizing these components. Same class of warning Task 6 reported.

## Files touched

- Created: `src/components/crm/views/deals.tsx`
- Created: `src/components/crm/views/pipeline.tsx`
- Created: `src/components/crm/views/deal-drawer.tsx`
- Modified: `worklog.md` (appended Task 7 entry)
- Modified: none other

## Hand-off notes for downstream agents

- The Kanban cross-column drop calls `useDealMutations().update.mutate({ id, stageId, probability })`. The deals API route at `/api/crm/deals/route.ts` already creates a `pipeline_changed` activity on stage change, so my Kanban doesn't need to log activities itself.
- The pipeline Kanban uses `localDeals` state synced to the query via `useEffect` so same-column reorders don't trigger refetches. If you wire up realtime updates (e.g. websocket invalidation), the local state will resync on the next query refetch.
- The forecasting panel's win-rate uses both `deal.closeReason` and `stage.isWon/isLost` for robustness — if your data model only sets one, the calculation still works.
- The "Add stage" feature sends the full stages array (existing + new) to the pipeline PATCH endpoint. The new stage gets a generated `id` (`stage-${Date.now()}-${random}`) so the backend can treat it as "create or update by id" — if your backend instead expects only the new stage, you'll need to adjust.
- The deal-drawer's `useEffect` for stage-probability sync only fires in create mode (to avoid overriding user-set probability on existing deals). If you want edit-mode stage changes to also auto-update probability, remove the `isCreate` guard.
- The `usePipelines()` hook returns `unknown` — I cast to `Pipeline[]` locally in both `deals.tsx` and `pipeline.tsx`. Reuse this pattern rather than modifying the shared hook.
- The deal-drawer's expected-close date picker uses `date-fns`'s `format(date, 'MMM d, yyyy')` for the trigger button label. The Calendar itself is `react-day-picker` v9 (already installed and configured in `src/components/ui/calendar.tsx`).
- The deal-drawer follows the same conventions as Task 6's LeadDrawer: `pr-12` on header (room for Sheet X), sticky Tabs with bottom-border active indicator, sticky footer with Delete + Save. Don't add your own close button or you'll get two stacked X icons.
