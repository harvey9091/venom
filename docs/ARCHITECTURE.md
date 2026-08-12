# Venom CRM — Architecture

## Overview

Venom CRM is a multi-tenant SaaS CRM built with Next.js 16 and Supabase. The application uses Supabase for authentication and Prisma for database ORM access to the same Supabase PostgreSQL database.

## Key Architectural Decisions

### Dual Auth/Data Layer
- **Supabase Auth** manages user authentication (signup, login, session, password reset)
- **Prisma ORM** manages all CRM data access
- Both connect to the same Supabase PostgreSQL database
- The `public.users` table bridges Supabase `auth.users` with application data via `auth_id`

### Workspace Model
- Every CRM entity belongs to a workspace
- Users can belong to multiple workspaces via `memberships`
- Workspace isolation is enforced at the database level via RLS policies
- The `current_user_workspace_ids()` SQL function determines accessible workspaces

### API Architecture
- Route handlers in `src/app/api/crm/` handle all CRM operations
- Authentication is derived from Supabase session (cookies or Authorization header)
- Authorization uses `requireAuth()`, `requireWorkspace()`, and `requireWorkspaceRole()` helpers
- All responses use the `ok()` / `fail()` pattern with security headers

### Client State
- `Zustand` manages global client state (user, workspace, navigation, notifications)
- `TanStack Query` manages server state with 20s stale time
- `Supabase Realtime` provides live updates for leads, deals, tasks, notifications

## Directory Structure

```
src/
  app/
    (auth)/                    # Auth layout group
      login/page.tsx
      signup/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
      auth-error/page.tsx
    api/
      auth/
        callback/route.ts      # Auth callback
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
        activities/route.ts    # Activities
        tags/route.ts          # Tags
        settings/route.ts      # Settings
        search/route.ts        # Global search
        notifications/route.ts # Notifications
        integrations/route.ts  # Integrations
        workspaces/
          route.ts             # List workspaces
          switch/route.ts      # Switch workspace
    layout.tsx
    page.tsx                   # CRM home (protected)
  components/
    auth/                      # Auth UI components
    crm/                       # CRM UI components
      shell/                   # App shell (sidebar, topbar, drawers)
      views/                   # Feature views (leads, deals, etc.)
      thinking/                # AI assistant / thinking indicator
    ui/                        # shadcn/ui primitives
  hooks/
    use-auth.ts                # Supabase auth hook
    use-mobile.ts              # Mobile breakpoint hook
    use-toast.ts               # Toast hook
  lib/
    auth/
      server.ts                # Server-side auth helpers
      session.ts               # Session management
    db.ts                      # Prisma client singleton
    supabase-server.ts         # Supabase SSR client
    supabase-client.ts         # Supabase browser client
    api.ts                     # API utilities (ok, fail, requireAuth, etc.)
    security.ts                # Security utilities
    store.ts                   # Zustand app store
    types.ts                   # TypeScript interfaces
    realtime.ts                # Supabase realtime
    theme.ts                   # Theme management
    utils.ts                   # General utilities
```

## Request Flow

1. User visits app → `middleware.ts` checks session
2. Unauthenticated → redirect to `/login`
3. Authenticated → `Providers` → `IdentityBootstrap` → `/api/crm/bootstrap`
4. Bootstrap creates/finds user profile, workspace, membership, default pipeline
5. `AuthGuard` renders `AppShell` with current view
6. View components fetch data via TanStack Query

## Security Model

- RLS policies enforce workspace isolation at the database level
- API routes derive identity from Supabase session, never trust client-provided IDs
- `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client-side code
- Security headers are added to all API responses
