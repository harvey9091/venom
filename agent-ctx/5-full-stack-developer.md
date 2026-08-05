# Task 5 — full-stack-developer — Dashboard view

## What was built

`/home/z/my-project/src/components/crm/views/dashboard.tsx` — a `'use client'` component exporting `DashboardView`. Renders the default landing page of Pulse CRM.

## Architecture decisions

- **Local type re-declaration:** `useDashboard()` in `src/lib/hooks.ts` returns `unknown` (it just does `return j.data`). I declared a local `DashboardData` interface that mirrors the server payload from `/api/crm/dashboard/route.ts` and cast `raw as DashboardData | undefined`. This keeps the dashboard fully typed without modifying the shared hook.
- **Primitives over reuse:** Built small internal primitives (`CardShell`, `CardHead`, `Legend`, `dueLabel`) so each of the 8 widgets stays self-contained and the file has no circular imports.
- **`card-premium` marker class:** Applied on every card div alongside `bg-card`, `border-border/60`, `shadow-soft`, and `hover:-translate-y-px hover:shadow-glow`. The marker class itself has no base styles but is what `[data-card-style="outlined|elevated|filled"] .card-premium` selectors in `globals.css` hook into — so the theme's card-style setting continues to work.
- **Chart colors:** Strictly `var(--chart-1)` through `var(--chart-5)` for all chart series, gradient fills, and accent tints (via `color-mix`). The only Tailwind palette colors used are `emerald`/`rose` for delta positive/negative — consistent with the existing `PriorityPill` and `ScoreBar` in `shared.tsx`.
- **Animations:** Framer Motion `container` + `item` variants with `staggerChildren: 0.05` and a 400ms ease-out entrance per card.
- **Empty / loading states:** `DashboardSkeleton` mirrors the exact 12-col grid (4 KPI cards + quick-actions + 6 panels). `DashboardEmpty` uses the shared `EmptyState` helper with Sparkles icon and two CTA buttons.

## Public API

```ts
export function DashboardView(): JSX.Element
```

Renders one of three states based on `useDashboard()`:
- `isLoading === true` → `<DashboardSkeleton />`
- `!data` or all metrics zero + no activities/tasks → `<DashboardEmpty />`
- otherwise → animated 12-col grid with all 8 widgets.

## Interactions wired up

| Widget | Action | Store call |
|---|---|---|
| QuickActions → New Lead | open lead create drawer | `openDrawer('lead-new')` |
| QuickActions → New Deal | open deal create drawer | `openDrawer('deal-new')` |
| QuickActions → Import CSV | navigate to import view | `navigate('import')` |
| QuickActions → New Task | open task create drawer | `openDrawer('task-new')` |
| Upcoming Tasks row | open task detail drawer | `openDrawer('task', task.id)` |
| Recent Leads row | open lead detail drawer | `openDrawer('lead', lead.id)` |
| Empty state → New Lead | open lead create drawer | `openDrawer('lead-new')` |
| Empty state → Import CSV | navigate to import view | `navigate('import')` |

## Data shape consumed (from `useDashboard()`)

```ts
{
  metrics: {
    revenue, pipelineValue, weightedPipeline,
    dealCount, wonDeals, lostDeals, openDeals,
    leadCount, contactCount, avgDealSize,
    conversionRate, wonRate
  },
  monthly: [{ label, revenue, pipeline }],       // 6 months
  leadSources: [{ name, value }],
  pipelines: [{ id, name, stages: [{ id, name, color, probability, dealCount, value }] }],
  upcomingTasks: Task[],
  recentLeads: Lead[],
  activities: Activity[]
}
```

## Lint status

`bunx eslint src/components/crm/views/dashboard.tsx` → **0 errors, 0 warnings**.

(Pre-existing lint issues in `src/components/crm/shared.tsx` and `src/components/crm/shell/command-palette.tsx` were intentionally left untouched per task constraints.)

## Files touched

- Created: `src/components/crm/views/dashboard.tsx`
- Modified: none

## Hand-off notes for downstream agents

- The dashboard casts `useDashboard()` data to a local `DashboardData` interface. If you change the server payload shape in `/api/crm/dashboard/route.ts`, update the local interface in this file too.
- The `dueLabel()` helper wraps `relTime()` from `shared.tsx` to make future due dates read as "Due in 3d" instead of "just now" (which is what `relTime` returns for future timestamps). Other views may want to reuse this pattern — feel free to lift it into `shared.tsx` if useful.
- The `CardShell` primitive in this file is dashboard-local. If multiple views end up wanting the same premium card with hover-lift, consider promoting it to `shared.tsx` as a shared `PremiumCard` component.
