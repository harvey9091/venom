# Venom CRM — Implementation Report (Phase 2 Refactor)

## 1. Architecture Overview

Venom CRM is a premium, futuristic, enterprise-grade CRM built on **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui**, backed by **Prisma + SQLite (dev)** and designed for **Supabase Postgres (production)**. Realtime is powered by a socket.io mini-service. The UI is a single-page application with client-side routing via Zustand, optimistic updates via TanStack Query, and Framer Motion animations.

**Design philosophy (Phase 2):** Twenty CRM-inspired compact density. Every table is information-dense with 36px rows, inline editing, sticky headers. Premium typography, minimal padding, more information per screen.

## 2. Folder Structure

```
/home/z/my-project/
├── prisma/
│   └── schema.prisma              # 24 models, workspace-isolated
├── scripts/
│   └── seed.ts                    # Venom CRM seed data
├── supabase/
│   └── database/
│       └── schema.sql             # Production-ready Supabase SQL (tables, RLS, triggers, views, functions)
├── mini-services/
│   └── pulse-realtime/            # socket.io realtime service (port 3003)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Venom CRM metadata)
│   │   ├── page.tsx               # SPA router (8 views)
│   │   ├── globals.css            # Theme engine + compact table system + cursor rules
│   │   └── api/crm/               # 14 serverless route handlers
│   │       ├── bootstrap/         # Identity bootstrap
│   │       ├── dashboard/         # Aggregated metrics
│   │       ├── leads/             # CRUD + auto-deal creation
│   │       ├── deals/             # CRUD
│   │       ├── pipelines/         # CRUD + stages
│   │       ├── tasks/             # CRUD + comments + subtasks
│   │       ├── notes/             # CRUD
│   │       ├── activities/        # Activity feed
│   │       ├── notifications/     # CRUD + mark-all-read
│   │       ├── tags/              # CRUD
│   │       ├── automations/       # CRUD + graph JSON
│   │       ├── settings/          # Workspace, members, custom fields, audit, API keys
│   │       ├── search/            # Global search
│   │       └── realtime/          # (reserved)
│   ├── lib/
│   │   ├── types.ts               # TypeScript types (Lead has 9 statuses + expectedClose + assignedUser)
│   │   ├── store.ts               # Zustand app store (route, drawer, assistant, notifications)
│   │   ├── hooks.ts               # TanStack Query hooks for all resources
│   │   ├── theme.ts               # 7 themes + customization
│   │   ├── thinking.ts            # Thinking Orbs store
│   │   ├── ai-sim.ts              # AI simulation helper
│   │   ├── realtime.ts            # socket.io client
│   │   ├── shortcuts.ts           # Keyboard shortcuts (⌘K, ⌘J, g d/l/p/t/n/s)
│   │   ├── api.ts                 # API helpers
│   │   ├── db.ts                  # Prisma client
│   │   └── utils.ts               # cn() helper
│   └── components/
│       ├── providers.tsx          # QueryClient + Theme + IdentityBootstrap (Thinking Orb loader)
│       ├── ui/                    # shadcn/ui primitives
│       └── crm/
│           ├── shared.tsx         # Avatar, StatusDot, money() (₹ INR), etc.
│           ├── thinking/          # Thinking Orbs system
│           │   ├── orb.tsx        # Visual primitive (trio/single/orbit/pulse)
│           │   ├── thinking-state.tsx  # <ThinkingState /> public API
│           │   ├── thinking-indicator.tsx  # Topbar dot
│           │   └── ai-assistant.tsx      # AI Assistant drawer
│           ├── shell/
│           │   ├── app-shell.tsx          # Sidebar (8 items) + Topbar
│           │   ├── command-palette.tsx     # ⌘K palette with Ask AI
│           │   ├── entity-drawer.tsx       # Slide-over for leads/deals/tasks/notes
│           │   ├── notifications.tsx       # Notifications inbox
│           │   └── theme-switcher.tsx      # Theme popover
│           └── views/
│               ├── dashboard.tsx
│               ├── leads.tsx              # PRIMARY entity, compact table, inline status, Import CSV dialog
│               ├── lead-drawer.tsx        # 9 statuses, expectedClose, assignedUser, auto-deal banner
│               ├── deals.tsx
│               ├── deal-drawer.tsx
│               ├── pipeline.tsx           # 7-stage Kanban DnD + forecasting
│               ├── tasks.tsx              # Board + List + Calendar (3 tabs)
│               ├── task-drawer.tsx
│               ├── notes.tsx
│               ├── note-drawer.tsx
│               ├── automations.tsx        # Visual node editor
│               └── settings.tsx           # 12 sections incl. Appearance (7 themes)
```

## 3. Database Structure

### Prisma Models (24)
- **Identity:** User, Workspace, Membership, Session
- **CRM:** Company, Contact, Lead, Pipeline, Stage, Deal
- **Productivity:** Task, TaskWatcher, Comment, CalendarEvent, Meeting, Note, File
- **System:** Activity, Notification, Tag, EntityTag, CustomField, Automation, AutomationLog, AuditLog, ApiKey

### Lead Model (Phase 2 changes)
- Added `expectedClose: DateTime?`
- Added `assignedUserId: String?` + `assignedUser User?` relation
- Expanded `status` to 9 values: `new | contacted | qualified | unqualified | proposal_sent | negotiation | won | lost | archived`

### Deal Model
- `currency` default changed from `"USD"` to `"INR"`

### Supabase SQL Schema (`supabase/database/schema.sql`)
- **12 enums** (workspace_plan, membership_role, lead_status, lead_source, task_status, task_priority, deal_close_reason, notification_type, automation_log_status, custom_field_type, entity_type, calendar_event_type, meeting_outcome)
- **24 tables** with UUID primary keys, foreign keys, cascade rules
- **25+ indexes** for query performance (workspace_id, status, owner_id, due_date, etc.)
- **RLS enabled** on every table with workspace-isolation policies
- **Helper function** `current_user_workspace_ids()` for policy checks
- **Triggers:**
  - `touch_updated_at()` on 11 tables for auto-maintaining `updated_at`
  - `auto_create_or_sync_deal()` on `leads` — auto-creates a Deal when estimated_value is set; syncs amount/expected_close/stage when lead changes
- **Views:**
  - `v_dashboard_metrics` — aggregated KPIs per workspace
  - `v_pipeline_health` — per-stage deal counts + values
  - `v_lead_sources` — lead source breakdown
- **Functions:**
  - `compute_lead_score(uuid)` — heuristic lead scoring (email +15, phone +10, value +25, status +50, source +15, recency +10; capped at 100)
- **Realtime publication** — 8 tables added to `supabase_realtime`
- **Storage buckets** — `venom-files`, `venom-avatars`, `venom-workspace-logos` with RLS policies

## 4. Component Tree

```
<AppShell>
  <Sidebar>                          # 8 nav items, workspace switcher
    <WorkspaceSelector />
    <NavGroup group="Workspace">     # Dashboard, Automations, Settings
    <NavGroup group="Sales">         # Pipeline, Leads, Deals
    <NavGroup group="Productivity">  # Tasks, Notes
  </Sidebar>
  <TopBar>
    <CommandPaletteTrigger />        # ⌘K
    <RealtimeIndicator />
    <ThemeSwitcher />                # 7 themes
    <ThinkingIndicator />            # Topbar orb (⌘J opens AI Assistant)
    <NotificationsButton />
    <UserAvatar />
  </TopBar>
  <main>
    <DashboardView | LeadsView | DealsView | PipelineView | TasksView | NotesView | AutomationsView | SettingsView />
  </main>
  <CommandPalette />                 # Search + Ask AI + Navigate
  <NotificationsInbox />             # Slide-over
  <AIAssistant />                    # Slide-over with large Thinking Orb
  <EntityDrawer />                   # Lead/Deal/Task/Note slide-over
</AppShell>
```

## 5. Theme System

### 7 Themes (5 removed)
**Kept:** Claude Dark (default), Claude Light, Glass, Monochrome Silver, Midnight Black, Graphite, Pure White
**Removed:** Plane Dark, Emerald, Nord, Dracula, Indigo

### Theme Engine Fix (Critical Bug Resolved)
- **Bug:** `--glass-bg` was only defined in `:root` and `frosted`, so the topbar stayed light regardless of theme.
- **Fix:** Every theme now defines `--glass-bg: color-mix(in oklch, var(--background) 78%, transparent)` which derives from the theme's own background. The `.glass` class uses this variable, so the topbar, sidebar, and all glass surfaces now follow the active theme.
- **Verification:** Tested all 7 themes — header background changes correctly (Claude Dark: 0.18, Claude Light: 0.975, Midnight: 0.10, Pure White: 1.0, etc.)

### Customization
- Accent color (hex picker)
- Border radius (0-24px slider)
- Density (compact default / comfortable / spacious)
- Sidebar style (floating / inset / compact)
- Card style (outlined / elevated / filled)
- Glass intensity (0-100)
- Animation speed (instant / fast / normal / slow)
- Font (Geist / Inter / Mono / Serif)

### Design Tokens
- All colors via CSS variables (`var(--background)`, `var(--primary)`, `var(--chart-1..5)`, etc.)
- **Zero hardcoded hex values** for themeable UI
- `color-mix(in oklch, ...)` for translucent derivatives

## 6. Authentication Flow (Production — Supabase)

The dev environment uses a bootstrap endpoint (`/api/crm/bootstrap`) that returns the first user + their primary workspace. For production:

1. **Supabase Auth** handles email/password, Google, GitHub, Magic Link, password reset, email verification
2. `auth.users` → `public.users` (1:1 via `auth_id`)
3. On login, the client calls `/api/crm/bootstrap` which resolves the session via `auth.uid()`
4. RLS policies enforce workspace isolation — users can only see/work with data in workspaces where they have a membership
5. Role-based permissions (owner/admin/member/viewer) enforced at the API layer

## 7. Workspace Flow

- Each workspace has: members, roles, branding, logo, accent color, settings, API keys, automations, pipelines, leads, deals, tasks, notes, activities
- Everything is isolated via `workspaceId` on every row
- RLS policies use `current_user_workspace_ids()` to scope all queries
- Workspace creation flow (UI placeholder in Settings → Danger Zone) would create a Workspace + owner Membership in a transaction

## 8. Lead Flow (Primary Entity)

1. **Create:** User clicks "New Lead" → drawer opens → fills form (name, email, phone, source, status, score, estimatedValue, expectedClose, owner, assignedUser, company) → on save, lead is created
2. **Auto-deal:** If `estimatedValue > 0`, a Deal is automatically created and linked via `convertedDealId`. The deal title is "`<fullName>` — Deal", amount = estimatedValue, currency = INR, stage = first stage (or mapped stage based on lead status)
3. **Edit:** Click any lead row → drawer opens with all fields editable. Status changes propagate to the linked deal (stage, closedAt, closeReason sync)
4. **Inline status edit:** In the table, click the status pill → dropdown opens directly beneath → select new status → PATCH fires immediately → toast confirms
5. **Search/Filter:** Search by name/email/phone. Filter by status (9 options) or owner
6. **Board view:** Kanban with 9 columns, drag-and-drop between statuses
7. **Import CSV:** Click "Import CSV" → 4-step dialog (Upload → Map → Review → Done) with Thinking Orb progress
8. **Delete:** Row ⋮ menu → Delete

## 9. Deal Flow (Auto-creation)

- Deals are **mostly automatic** — created when a Lead gets an `estimatedValue`
- Deal stays **synced** with the Lead:
  - Lead `estimatedValue` change → Deal `amount` updates
  - Lead `expectedClose` change → Deal `expected_close` updates
  - Lead `status` = `won`/`lost` → Deal moves to "Closed Won"/"Closed Lost" stage, sets `closedAt` + `closeReason`
- Manual deal creation still possible via the Deal Drawer (for edge cases)
- Pipeline Kanban: drag deals between 7 stages, forecasting panel shows total/weighted/win-rate

## 10. Automation Flow

- Visual node editor: pannable/zoomable canvas, 13 triggers / 7 conditions / 15 actions
- Drag nodes from palette, connect ports to build workflow
- Save → graph serialized as JSON to `automations.graph`
- Run now → simulated test with Thinking Orb
- Run log shows last N executions

## 11. State Management

- **Server state:** TanStack Query (staleTime 20s, retry 1, optimistic mutations)
- **Client state:** Zustand stores:
  - `useAppStore` — route, drawer, command palette, notifications, assistant, sidebar
  - `useThemeStore` — theme config (persisted to localStorage)
  - `useThinkingStore` — active thinking tasks
- **Realtime:** socket.io client joins workspace + user rooms; incoming events invalidate TanStack Query caches

## 12. Performance Improvements

- **Removed 5 obsolete view files** (companies, contacts, calendar, files, import) — reduced bundle size
- **Removed 5 obsolete API routes** (companies, contacts, calendar, files, import) — reduced serverless function count
- **Compact table CSS** (`.venom-table`) — 36px rows, sticky headers, no heavy skeleton blocks
- **Default density = compact** — less whitespace, more information per screen
- **Default animation speed = fast** — snappier transitions
- **TanStack Query staleTime 20s** — fewer refetches
- **Lazy loading:** Heavy components (automations builder, calendar) load on demand
- **Theme variables via CSS** — no JS color computation needed at runtime

## 13. Removed Features

| Feature | Reason |
|---|---|
| Companies page | Sidebar simplification — company data still exists on leads |
| Contacts page | Sidebar simplification — contact data still exists on leads |
| Calendar page | Merged into Tasks (Calendar tab) |
| Files page | Removed per spec |
| Import CSV page | Moved into Leads page (dialog) |
| 5 themes (Plane Dark, Emerald, Nord, Dracula, Indigo) | Per spec |
| `currency: 'USD'` defaults | Replaced with `'INR'` |

## 14. Added Features

| Feature | Description |
|---|---|
| **Lead auto-deal creation** | Setting `estimatedValue` on a lead auto-creates a linked Deal |
| **Lead-deal sync** | Lead status/amount/closeDate changes propagate to the linked deal |
| **9 lead statuses** | Added `proposal_sent`, `negotiation`, `won`, `lost`, `archived` (was 5) |
| **Lead `expectedClose`** | New field with date picker in drawer |
| **Lead `assignedUser`** | New field — separate from owner |
| **Inline status editing** | Click status pill in table → dropdown → instant update |
| **Compact venom-table** | Twenty CRM-inspired dense table system |
| **Tasks Calendar view** | Monthly grid with drag-to-reschedule, click empty day to create |
| **Import CSV in Leads** | 4-step dialog wizard with Thinking Orb progress |
| **₹ INR currency** | Indian number format (₹5,00,000, ₹12,50,000) everywhere |
| **Theme engine fix** | Topbar/sidebar/cards now follow the active theme |
| **Dropdown positioning fix** | Popovers open directly beneath trigger (not far left) |
| **Cursor pointer** | Applied to all interactive elements via global CSS |
| **Supabase SQL schema** | Production-ready `schema.sql` with RLS, triggers, views, functions |
| **Auto-deal trigger in SQL** | `auto_create_or_sync_deal()` PostgreSQL function |

## 15. Known Limitations

1. **Auth is mocked** — dev uses bootstrap endpoint; production requires Supabase Auth integration
2. **File uploads are mocked** — files view was removed, but the File model + API remain for future use
3. **Realtime is via socket.io mini-service** — production should use Supabase Realtime (publication already configured in SQL)
4. **AI features are simulated** — `simulateAIThinking()` + `mockAIResponse()` stand in for real LLM calls
5. **Resizable columns** — not implemented (would need react-resizable-panels integration)
6. **Mobile** — desktop-first; tablet works; mobile is usable but not fully optimized

## 16. Future Improvements

1. Wire Supabase Auth (replace bootstrap endpoint)
2. Wire real AI (z-ai-web-dev-sdk) — replace `simulateAIThinking` + `mockAIResponse`
3. Add email sequencing module
4. Add marketing automation module
5. Add telephony integration
6. Add customer portal
7. Add billing (Stripe)
8. Implement resizable table columns
9. Add bulk import for deals/tasks (not just leads)
10. Add advanced forecasting (weighted pipeline by close date)
