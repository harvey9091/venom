# Pulse CRM — Premium Open-Source CRM

A production-grade, premium CRM inspired by **Plane, Linear, Notion, Attio, and Arc Browser**.
Built on Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui, backed by Prisma (SQLite locally,
Supabase-ready in production) with a socket.io mini-service for realtime updates.

## Live Preview

Open the app via the Preview Panel (or `https://preview-<bot-id>.space-z.ai/`).
It boots directly into the **Acme Inc.** demo workspace seeded with 5 users, 8 companies,
40 contacts, 60 leads, 50 deals across a 7-stage pipeline, 30 tasks, 25 notes, 8 files,
20 calendar events, 4 automations, and 12 notifications.

## What's inside

### Core architecture
- **Workspace-isolated** data model — every row carries `workspaceId`, ready for multi-tenant SaaS
- **Client-side router** (Zustand) — instant view switching with no full-page refreshes
- **TanStack Query** layer for all server state with optimistic-aware mutations
- **Realtime socket.io** mini-service on port 3003 — broadcasts entity events, notifications, activity feed
- **Theme engine** — 14 handcrafted themes (Plane Dark, Claude Light/Dark, Silver, Graphite, Midnight, Frosted Glass, Ocean, Emerald, Indigo, Beige, Dracula, Nord, Pure White) + deep customization (accent, radius, density, sidebar style, card style, glass intensity, animation speed, font)
- **Keyboard shortcuts** everywhere — `⌘K` command palette, `g d/l/c/p/t/a/s` Linear-style navigation, `⌘\` toggle sidebar

### Modules
| Module | What's there |
|---|---|
| **Dashboard** | 4-card KPI strip (revenue, pipeline, deals, conversion), revenue+pipeline area chart, lead-sources donut, pipeline-health stacked bars, upcoming tasks, recent leads, activity feed timeline, quick-actions strip. Framer Motion staggered entrance. |
| **Pipeline (Kanban)** | 7-stage drag-and-drop board (`@dnd-kit`), inline "Add stage", forecasting panel (total, weighted, win rate, by-stage bar). Card click → deal drawer. |
| **Deals** | TanStack Table with sortable columns, colored stage pills, probability mini-bars, past-due highlighting, bulk selection. |
| **Leads** | Table + Board (Kanban by status, drag-to-update), filters (status/source/owner), bulk actions, slide-over drawer with Overview/Activity/Notes/Files tabs. |
| **Contacts** | Table + Cards grid, hover lift, slide-over drawer. |
| **Companies** | Table + Cards grid with industry badges, contacts count. |
| **Tasks** | Board (4-column Kanban with DnD) + List table, priority pills, subtask counters, drawer with Details/Subtasks/Comments tabs (comments use Prisma nested writes). |
| **Calendar** | Day / Week / Month / Agenda views, drag-to-create events, drag-to-move, current-time indicator, mini-calendar side panel. |
| **Notes** | Masonry grid, pinned toggle, autosave (debounced 800ms), linked-entity combobox. |
| **Files** | Grid + List views, drag-and-drop upload (mock), mime-typed icons, version badges, preview drawer (image/PDF/video/audio). |
| **Automations** | Visual node editor — pannable/zoomable canvas, 13 triggers / 7 conditions / 15 actions, port-based edge drawing, mini-map, undo/redo (Ctrl+Z), node inspector, run log. |
| **CSV Import** | 4-step wizard: Upload (drag-drop + paste + template) → Map Columns (auto-match) → Review & Confirm → Done + History with Undo. |
| **Settings** | 12 sections: Workspace, Members, Appearance (theme engine), Pipelines, Custom Fields, Tags, Notifications, Integrations, API Keys (one-time raw-key reveal), Audit Logs, Exports (client-side CSV), Danger Zone. |

### Premium UX
- Soft shadows + large border radius throughout
- Glass top bar with backdrop blur
- Skeleton loaders on every async surface
- Framer Motion view transitions
- Optimistic updates with sonner toasts
- Custom-styled scrollbars
- Sticky table headers, hover-lift cards, gradient text accents
- Theme switching is **instant** — no flash, no reload

## Local development

```bash
bun install
bun run db:push     # sync Prisma schema to SQLite
bun run db:seed     # seed Acme Inc. demo workspace
bun run dev         # Next.js on http://localhost:3000

# Realtime service (separate terminal)
cd mini-services/pulse-realtime
bun install
bun run dev         # socket.io on http://localhost:3003
```

## Deploy to Vercel + Supabase

The data layer is intentionally Supabase-portable:
1. Push schema to Supabase Postgres — change `datasource db` provider to `"postgresql"` and run `prisma db push`
2. Swap `src/lib/db.ts` for a Supabase client if you prefer to skip Prisma
3. Replace `/api/crm/bootstrap` with a Supabase Auth session resolver
4. Deploy to Vercel — every route is a serverless function out of the box
5. Deploy the `mini-services/pulse-realtime` service to a Vercel Edge Function or keep it on Render/Railway

## Tech stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York) + tw-animate-css
- **State**: Zustand (client) + TanStack Query (server)
- **Forms**: React Hook Form + Zod
- **Tables**: TanStack Table
- **DnD**: @dnd-kit/core + @dnd-kit/sortable
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Icons**: lucide-react
- **Database**: Prisma + SQLite (dev) → Supabase Postgres (prod)
- **Realtime**: socket.io (mini-service)

## License
Open source — extend freely.
