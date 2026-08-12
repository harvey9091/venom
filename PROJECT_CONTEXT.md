# VENOM CRM — PROJECT CONTEXT

## 1. Project Overview

Venom CRM is a premium, enterprise-grade Customer Relationship Management platform designed for modern sales teams. It provides a compact, dense, and professional workspace for managing leads, deals, contacts, companies, tasks, notes, and sales pipelines.

## 2. Product Purpose

- Provide a fast, keyboard-driven CRM experience
- Enable sales teams to track leads through customizable pipelines
- Support multi-workspace collaboration with role-based access
- Offer real-time updates and AI-assisted workflows

## 3. Main Users

- Sales representatives
- Account executives
- Sales managers
- Revenue operations teams

## 4. Core CRM Features

- **Dashboard**: Metrics, revenue tracking, pipeline health, upcoming tasks
- **Leads**: Lead management with status tracking, scoring, and conversion
- **Deals**: Deal tracking through pipeline stages with probability forecasting
- **Contacts**: Contact management linked to companies
- **Companies**: Company records with industry, size, and revenue data
- **Tasks**: Task management with priorities, due dates, and watchers
- **Notes**: Activity notes linked to leads, contacts, deals, companies
- **Pipeline**: Visual kanban pipeline with customizable stages
- **Automations**: Visual node-based automation builder
- **Tags**: Flexible tagging system for entities
- **Notifications**: Real-time notifications with read/unread states
- **Settings**: Workspace preferences, theme, navigation mode

## 5. Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui + Radix UI |
| State Management | Zustand |
| Server State | TanStack Query v5 |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| ORM | Prisma 6 |
| Realtime | Supabase Realtime |
| Icons | Lucide React, Tabler Icons |
| Animations | Framer Motion, Motion |

## 6. Architecture

### Client-Server Boundary
- Next.js App Router with server and client components
- API routes in `src/app/api/` handle all server-side logic
- Client components marked with `'use client'`

### Authentication Architecture
- Supabase Auth handles signup, login, session, password reset
- `useAuth()` hook manages client-side auth state
- Server-side auth uses `createSupabaseServerClient()` with cookies
- API routes verify auth via `requireAuth()` which checks Supabase session + Prisma user

### Workspace Architecture
- Each user can belong to multiple workspaces via `memberships`
- One workspace is "active" at a time (stored in localStorage)
- Workspace switching via `/api/crm/workspaces/switch`
- All CRM data is workspace-scoped

### Database Architecture
- Supabase PostgreSQL with Prisma ORM
- `public.users` bridges Supabase `auth.users` with application data
- All CRM tables have `workspace_id` for multi-tenancy
- RLS policies enforce workspace isolation at the database level

## 7. Directory Structure

```
src/
  app/
    (auth)/                    # Auth route group
      layout.tsx
      login/page.tsx
      signup/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
      auth-error/page.tsx
    api/
      route.ts                 # Health check
      auth/
        callback/route.ts      # OAuth callback
        provision/route.ts     # Workspace provisioning
        session/route.ts       # Session info
      crm/
        bootstrap/route.ts     # Workspace bootstrap
        dashboard/route.ts     # Dashboard metrics
        leads/route.ts         # Leads CRUD
        deals/route.ts         # Deals CRUD
        contacts/route.ts      # Contacts CRUD
        companies/route.ts     # Companies CRUD
        tasks/route.ts         # Tasks CRUD
        notes/route.ts         # Notes CRUD
        pipelines/route.ts     # Pipelines CRUD
        activities/route.ts    # Activity log
        tags/route.ts          # Tags CRUD
        settings/route.ts      # Settings
        search/route.ts        # Global search
        notifications/route.ts # Notifications
        integrations/route.ts  # Integrations
        workspaces/
          route.ts             # List workspaces
          switch/route.ts      # Switch workspace
    layout.tsx                 # Root layout
    page.tsx                   # CRM home (protected)
  components/
    auth/                      # Auth UI
      auth-guard.tsx           # Route protection
      auth-layout.tsx          # Auth layout wrapper
      symbiote-logo.tsx        # Logo component
    crm/                       # CRM UI
      shell/                   # App shell
        app-shell.tsx          # Main layout
        app-content-container.tsx
        command-palette.tsx    # Cmd+K palette
        entity-drawer.tsx      # Entity detail drawer
        notifications.tsx      # Notification inbox
        theme-switcher.tsx
        venom-floating-dock.tsx
      thinking/                # AI assistant
        ai-assistant.tsx
        orb.tsx
        thinking-indicator.tsx
        thinking-state.tsx
      views/                   # Feature views
        dashboard.tsx
        leads.tsx
        deals.tsx
        pipeline.tsx
        tasks.tsx
        notes.tsx
        automations.tsx
        settings.tsx
        lead-drawer.tsx
        deal-drawer.tsx
        task-drawer.tsx
        note-drawer.tsx
      QueryView.tsx
      shared.tsx
      ViewErrorBoundary.tsx
    ui/                        # shadcn/ui primitives (40+ components)
    providers.tsx              # Root providers (Query, Theme, Auth bootstrap)
  hooks/
    use-auth.ts                # Supabase auth hook
    use-mobile.ts              # Mobile breakpoint
    use-toast.ts               # Toast notifications
  lib/
    auth/
      server.ts                # Server-side auth helpers
      session.ts               # Session management
    db.ts                      # Prisma client singleton
    supabase-server.ts         # SSR Supabase client
    supabase-client.ts         # Browser Supabase client
    supabase.ts                # Re-export
    api.ts                     # API utilities
    security.ts                # Security utilities
    store.ts                   # Zustand store
    types.ts                   # TypeScript types
    realtime.ts                # Supabase realtime
    theme.ts                   # Theme management
    shortcuts.ts               # Keyboard shortcuts
    nav-prefs.ts               # Navigation preferences
    utils.ts                   # General utilities
    validation-schemas.ts      # Zod schemas
    ai-sim.ts                  # AI simulation
    thinking.ts                # Thinking utilities
public/                        # Static assets
supabase/
  database/
    schema.sql                 # Canonical database schema
prisma/
  schema.prisma                # Prisma ORM schema
docs/                           # Documentation
scripts/
  seed-demo.ts                  # Demo data seeder
tests/                          # Test scripts
```

## 8. Application Entry Points

| Entry Point | Purpose |
|-------------|---------|
| `src/app/layout.tsx` | Root layout with providers |
| `src/app/page.tsx` | CRM home (protected) |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/signup/page.tsx` | Signup page |
| `src/app/api/crm/bootstrap/route.ts` | Workspace bootstrap |
| `middleware.ts` | Auth middleware |

## 9. Authentication Architecture

1. User signs up via Supabase Auth
2. Supabase creates `auth.users` record
3. User logs in, Supabase issues session cookie + JWT
4. Client `useAuth()` hook reads session
5. Server routes verify session via `createSupabaseServerClient()`
6. Application creates `public.users` profile linked via `auth_id`
7. Workspace is created on first bootstrap

## 10. Workspace Architecture

- **Multi-tenant**: Each workspace is isolated
- **Memberships**: Users join workspaces with roles (owner, admin, member, viewer)
- **Active workspace**: Stored in localStorage
- **Switching**: POST to `/api/crm/workspaces/switch`
- **Provisioning**: New users get a workspace on first login

## 11. Database Architecture

### Schema Source of Truth
`supabase/database/schema.sql` is the canonical schema.

### ORM
Prisma 6 with `@prisma/client` for type-safe database access.

### Key Tables
- `users` - Application user profiles
- `workspaces` - Tenant workspaces
- `memberships` - User-workspace relationships
- `leads`, `contacts`, `companies`, `deals`, `tasks`, `notes` - CRM entities
- `pipelines`, `stages` - Sales pipelines
- `activities`, `notifications`, `tags`, `custom_fields` - Supporting entities

## 12. Complete Database Table List

See `docs/DATABASE.md` for the complete table reference.

## 13. Table Relationships

See `docs/DATABASE.md` for the relationship diagram.

## 14. RLS Model

All workspace-scoped tables use RLS policies. The `current_user_workspace_ids()` function returns the set of workspace IDs the current user can access. Policies use this to filter rows.

## 15. API Routes

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/crm/bootstrap` | GET | Required | Initialize workspace |
| `/api/crm/dashboard` | GET | Required | Dashboard metrics |
| `/api/crm/leads` | GET, POST, PATCH, DELETE | Required | Leads CRUD |
| `/api/crm/deals` | GET, POST, PATCH, DELETE | Required | Deals CRUD |
| `/api/crm/contacts` | GET, POST, PATCH, DELETE | Required | Contacts CRUD |
| `/api/crm/companies` | GET, POST, PATCH, DELETE | Required | Companies CRUD |
| `/api/crm/tasks` | GET, POST, PATCH, DELETE | Required | Tasks CRUD |
| `/api/crm/notes` | GET, POST, PATCH, DELETE | Required | Notes CRUD |
| `/api/crm/pipelines` | GET, POST, PATCH, DELETE | Required | Pipelines CRUD |
| `/api/crm/activities` | GET, POST | Required | Activities |
| `/api/crm/tags` | GET, POST, PATCH, DELETE | Required | Tags CRUD |
| `/api/crm/settings` | GET, PATCH | Required | Settings |
| `/api/crm/search` | GET | Required | Global search |
| `/api/crm/notifications` | GET, PATCH | Required | Notifications |
| `/api/crm/workspaces` | GET | Required | List workspaces |
| `/api/crm/workspaces/switch` | POST | Required | Switch workspace |

## 16. Server Actions

No server actions. All mutations go through API routes.

## 17. Important Hooks

- `useAuth()` - Authentication state and methods
- `useAppStore()` - Global app state (Zustand)
- `useRealtime()` - Supabase realtime subscriptions
- `useThemeStore()` - Theme preferences
- `useNavStore()` - Navigation preferences

## 18. Important Components

- `Providers` - Root providers wrapper
- `IdentityBootstrap` - Workspace initialization
- `AuthGuard` - Route protection
- `AppShell` - Main CRM layout
- `CommandPalette` - Cmd+K search
- `EntityDrawer` - Entity detail view

## 19. State Management

- **Zustand**: `useAppStore` for global client state
- **TanStack Query**: Server state with 20s stale time
- **Supabase Realtime**: Live updates via Postgres changes

## 20. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | Server only |
| `NEXT_PUBLIC_APP_URL` | App URL for redirects | Recommended |

## 21. Deployment Architecture

- **Frontend**: Vercel (Next.js)
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (optional)

## 22. Supabase Configuration

- Auth: Email/password (default)
- Database: PostgreSQL with RLS
- Realtime: Enabled for leads, deals, tasks, notes, activities, notifications, calendar_events, automations

## 23. Vercel Configuration

See `vercel.json` for headers and build settings.

## 24. GitHub Configuration

- Main branch: `main`
- Connected to Vercel for auto-deployment

## 25. User Flows

### Sign Up
1. User visits `/signup`
2. Fills name, email, password
3. Supabase creates auth user
4. Redirect to email verification
5. After verification, user logs in
6. Bootstrap creates workspace

### Sign In
1. User visits `/login`
2. Enters email, password
3. Supabase validates credentials
4. Session established
5. Bootstrap loads/creates workspace
6. Redirect to `/dashboard`

### Workspace Bootstrap
1. Authenticated user hits `/api/crm/bootstrap`
2. Server finds or creates `User` profile
3. Server finds or creates `Workspace` + `Membership`
4. If new workspace, creates default pipeline + stages
5. Returns user, workspace, members, tags

## 26. Workspace Bootstrap Flow

See `/api/crm/bootstrap/route.ts` for implementation.

## 27. Error Handling

- API routes return structured errors: `{ ok: false, error, code }`
- Error codes: `AUTH_REQUIRED`, `DATABASE_CONNECTION_ERROR`, `DATABASE_SCHEMA_ERROR`, etc.
- Client shows retry UI for bootstrap failures
- No infinite loading states

## 28. Security Model

- RLS enforces workspace isolation
- API routes never trust client-provided IDs
- Service role key never exposed to client
- Security headers on all responses
- Rate limiting on write operations

## 29. Performance Considerations

- TanStack Query with 20s stale time
- Database indexes on common query columns
- Pagination via query parameters
- Realtime only for essential tables

## 30. Known Limitations

- Database is currently unreachable from local dev (needs Supabase project recovery)
- Some lint warnings in pre-existing UI components
- No automated tests yet

## 31. Future Improvements

- Automated test suite
- E2E testing with Playwright
- More comprehensive error boundaries
- Offline support
- Advanced filtering and bulk operations
- Email integration
- Calendar sync

## 32. Testing Strategy

- TypeScript: `npx tsc --noEmit`
- Lint: `npm run lint`
- Build: `npm run build`
- Manual: Full user journey testing

## 33. How to Run Locally

```bash
bun install
cp .env.example .env.local
# Edit .env.local
bun run db:push
bun run dev
```

## 34. How to Deploy

1. Push to GitHub
2. Vercel auto-deploys
3. Configure environment variables in Vercel
4. Run schema.sql in Supabase SQL Editor

## 35. How to Update Database Schema

1. Update `prisma/schema.prisma`
2. Run `bun run db:push`
3. Update `supabase/database/schema.sql` to match

## 36. Troubleshooting

### Bootstrap 500 Error
- Check database connectivity (`DATABASE_URL`)
- Verify Supabase project is not paused
- Check server logs for specific error

### Auth Not Working
- Verify Supabase URL and keys
- Check redirect URLs in Supabase Auth settings
- Ensure cookies are enabled

### Build Failing
- Clear `.next` directory
- Regenerate Prisma client
- Check TypeScript errors

## 37. Important Architectural Decisions

1. **Supabase + Prisma**: Auth handled by Supabase, data by Prisma
2. **Workspace isolation via RLS**: Database-level multi-tenancy
3. **Single bootstrap endpoint**: Centralized workspace initialization
4. **Zustand for client state**: Lightweight, simple global state
5. **No server actions**: All mutations via API routes

## 38. Things Future Developers Must NOT Break

1. **RLS policies**: Do not disable or weaken workspace isolation
2. **Auth flow**: Do not bypass Supabase session verification
3. **Bootstrap idempotency**: Must not create duplicate workspaces
4. **Authorization**: Never trust client-provided user/workspace IDs
5. **Service role key**: Never expose to client-side code
6. **Schema sync**: Keep `schema.prisma` and `schema.sql` in sync
