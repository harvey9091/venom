# Task: venom-phase3-empty-states

**Agent:** full-stack-developer
**Date:** 2025

## Summary

Updated all 8 primary CRM views to gracefully handle the zero-data (fresh workspace) state. The database has been wiped and the bootstrap endpoint auto-provisions a fresh workspace, so every view now needs beautiful, contextual empty placeholders instead of fake charts or broken lists.

## Files modified

1. **`src/components/crm/views/dashboard.tsx`** — major restructure:
   - `KpiCard` accepts `delta: string | null` + `muted?: boolean`. Delta hidden when null; accent line muted when value is 0.
   - `RevenueChart` — placeholder (dashed baseline + TrendingUp icon + "No revenue data yet") when monthly data is all-zero.
   - `LeadSourcesDonut` — empty donut ring with "No leads yet" centered + hint, when total is 0.
   - `PipelineOverview` — shows "No deals in pipeline yet" hint when every stage has 0 deals.
   - `TasksList` / `RecentLeadsList` / `ActivityFeed` — premium empty states with 40px muted icon, title, hint, and CTA button (where applicable).
   - `WelcomeBanner` (new) — "Welcome to Venom CRM 👋" + Create Lead / Import CSV buttons. Shown only when `m.leadCount === 0 && m.dealCount === 0 && m.contactCount === 0`.
   - `DashboardView` main render: removed early `isEmpty` return; always renders structure with `ZERO_METRICS` safe defaults. Removed unused `DashboardEmpty` function and `EmptyState` import. Added `useReducedMotion` from `framer-motion`.

2. **`src/components/crm/views/leads.tsx`**:
   - Board column empty text: "Drop here" → "No leads".
   - Board view always renders `LeadsBoard` (9 columns) — even when 0 leads.
   - Table empty state: title "No leads yet" → "No leads found", button "New Lead" → "Create Lead". Filter-aware titles preserved.

3. **`src/components/crm/views/deals.tsx`**:
   - Empty state hint updated to spec: "Deals are created automatically when you set an estimated value on a lead. You can also create one manually."
   - Button: "New deal" → "Create Deal".

4. **`src/components/crm/views/tasks.tsx`**:
   - Board column empty text: "Drop tasks here" → "No tasks".
   - Main render: `filtered.length === 0 && view !== 'calendar'` → `filtered.length === 0 && view === 'list'`. Board view always renders; calendar view always renders (empty grid + clickable cells).
   - List empty state: title "No tasks yet" → "No tasks", hint shortened to "Create your first task to start tracking work.", button "New task" → "Create Task".

5. **`src/components/crm/views/pipeline.tsx`**:
   - `ColumnBody` + `StageColumn` accept `pipelineEmpty?: boolean`. When true, column body shows "No active deals" instead of "Drop deals here".
   - `KanbanBoard` computes `pipelineEmpty={localDeals.length === 0}` and passes to all columns.
   - New `PipelineEmptyBanner` component: rendered above Kanban board when `deals.length === 0`. Shows "No active deals" + "Deals appear here automatically when you set an estimated value on a lead." hint + "Create Deal" button → `openDrawer('deal-new')`.
   - `ForecastingPanel` already handles empty data (money(0) = ₹0, winRate([]) = 0). No changes needed.

6. **`src/components/crm/views/notes.tsx`**:
   - Empty state title "No notes yet" → "No notes", hint → "Capture meeting notes, discovery call summaries, and context for your deals.", button "Create your first note" → "Create Note".

7. **`src/components/crm/views/automations.tsx`**:
   - `AutomationsEmptyState` title "Create your first automation" → "No automations", button "New Automation" → "Create from scratch". Template cards preserved.

8. **`src/components/crm/thinking/ai-assistant.tsx`** — verified, no changes needed. Already shows the ThinkingState orb, "Ready when you are", proper hint, 5 suggestion chips, and starts with empty messages array.

## Lint status

`bunx eslint` on all 8 files: **0 errors, 3 warnings — all pre-existing**:
- `ai-assistant.tsx:74:5` — unused eslint-disable directive (pre-existing)
- `deals.tsx:367:17` — TanStack Table incompatible-library warning (pre-existing)
- `tasks.tsx:671:17` — same TanStack Table warning (pre-existing)

Exit code: 0.
