# VENOM CRM — AI PROJECT CONTEXT

## What this project is

Venom CRM is a multi-tenant SaaS CRM for sales teams. It's built with Next.js 16, React 19, TypeScript, Supabase (auth + database), and Prisma (ORM). The app provides lead management, deal tracking, pipeline visualization, task management, notes, automations, and real-time collaboration.

## Current architecture

- **Next.js 16 App Router** with server and client components
- **Supabase Auth** for authentication (email/password)
- **Supabase PostgreSQL** as the database
- **Prisma 6** as the ORM layer
- **Zustand** for client-side global state
- **TanStack Query v5** for server state management
- **Supabase Realtime** for live updates
- **Tailwind CSS v4 + shadcn/ui** for UI

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Turbopack) |
| Language | TypeScript 5 (strict) |
| UI | React 19, Tailwind v4, shadcn/ui, Radix UI |
| Auth | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL |
| ORM | Prisma 6 |
| State | Zustand + TanStack Query |
| Realtime | Supabase Realtime |
| Icons | Lucide React, Tabler Icons |
| Animations | Framer Motion, Motion |
| Deploy | Vercel |

## Repository structure

```
src/
  app/
    (auth)/               # Login, signup, forgot/reset password
    api/
      auth/               # Auth callbacks, session, provision
      crm/                # CRM API routes (bootstrap, leads, deals, etc.)
    layout.tsx            # Root layout
    page.tsx              # CRM home
  components/
    auth/                 # AuthGuard, auth layout, logo
    crm/                  # AppShell, views, drawers, AI assistant
    ui/                   # shadcn/ui primitives
    providers.tsx         # Query, Theme, IdentityBootstrap providers
  hooks/
    use-auth.ts           # Supabase auth hook
  lib/
    db.ts                 # Prisma client
    supabase-server.ts    # SSR Supabase client
    supabase-client.ts    # Browser Supabase client
    api.ts                # API helpers (ok, fail, requireAuth, etc.)
    security.ts           # Rate limit, sanitization, CSRF
    store.ts              # Zustand store
    types.ts              # TypeScript interfaces
supabase/database/schema.sql  # Canonical DB schema
prisma/schema.prisma          # Prisma ORM schema
docs/                          # Documentation
```

## Authentication

- Supabase Auth manages sessions
- `useAuth()` hook provides `signIn`, `signUp`, `signOut`, `resetPassword`, `updatePassword`
- Server routes verify auth via `createSupabaseServerClient()` + `requireAuth()`
- `public.users` table bridges `auth.users(id)` with application data via `auth_id`

## Workspace model

- Multi-tenant: each workspace is isolated
- Users belong to workspaces via `memberships` table
- Roles: owner, admin, member, viewer
- One active workspace at a time (localStorage)
- All CRM data has `workspace_id`

## Database model

- 27 tables in `public` schema
- All CRM tables workspace-scoped
- RLS policies enforce isolation
- `current_user_workspace_ids()` function for policy checks
- UUID primary keys
- `updated_at` triggers on key tables

## CRM model

- **Leads**: full_name, email, phone, source, status, score, estimated_value
- **Contacts**: first_name, last_name, email, phone, company
- **Companies**: name, domain, industry, size, revenue
- **Deals**: title, amount, currency, pipeline, stage, probability
- **Tasks**: title, status, priority, due_date, assignee
- **Notes**: body, pinned, linked to entities
- **Pipelines**: name, is_default, stages
- **Activities**: type, summary, meta (JSON)
- **Tags**: workspace-scoped, polymorphic bindings
- **Automations**: trigger_type, graph (JSON)

## API model

- REST API under `/api/crm/`
- All endpoints require authentication
- Authorization via `requireAuth()`, `requireWorkspace()`, `requireWorkspaceRole()`
- Responses: `{ ok: true, data }` or `{ ok: false, error, code }`
- Security headers on all responses

## Frontend architecture

- Server components for initial data loading
- Client components for interactivity
- Zustand for global state (user, workspace, navigation)
- TanStack Query for server state (20s stale time)
- Supabase Realtime for live updates

## Security model

- RLS at database level
- API routes derive identity from session
- No client-trusted IDs
- Service role key server-only
- Rate limiting on writes
- Security headers

## Environment configuration

```
DATABASE_URL           # PostgreSQL connection
NEXT_PUBLIC_SUPABASE_URL   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY      # Server-only admin key
NEXT_PUBLIC_APP_URL            # App URL for redirects
```

## Deployment

- Vercel for frontend
- Supabase for database + auth
- `vercel.json` configures security headers

## Important implementation details

- Bootstrap endpoint (`/api/crm/bootstrap`) creates workspace on first login
- Lead statuses: new, contacted, qualified, unqualified, proposal_sent, negotiation, won, lost, archived, converted
- Default pipeline has 7 stages
- `lead.converted_deal_id` links leads to deals
- `workspace_preferences.nav_mode` controls sidebar vs dock

## Critical invariants

1. **Workspace isolation is enforced by RLS** - never disable
2. **Auth is always verified server-side** - never trust client
3. **Bootstrap is idempotent** - must not create duplicates
4. **Service role key is never client-exposed** - server-only
5. **Schema.prisma and schema.sql must stay in sync**

## Current known issues

- Database unreachable from local dev (Supabase project may be paused)
- Pre-existing lint warnings in UI components (carousel, use-mobile)
- No automated tests

## Resolved issues

- `/api/crm/bootstrap` 500 error (fixed with structured error handling and Authorization header support)
- Infinite bootstrap loop (fixed by removing duplicate calls)
- Missing 'converted' lead status (fixed in types and views)
- Loading UX without error state (fixed with retry UI)
- `useSearchParams` prerender error (fixed with Suspense boundary)

## How to safely modify this project

1. Always verify auth in server components/route handlers
2. Never expose service role key to client
3. Keep RLS policies intact
4. Update both `schema.prisma` and `schema.sql` when changing schema
5. Test bootstrap flow after workspace changes
6. Run `npm run build` before committing

## Common mistakes to avoid

- Mixing Supabase client types (browser vs server vs service)
- Trusting client-provided `user_id`, `workspace_id`
- Disabling RLS to "make it work"
- Creating duplicate workspace on bootstrap
- Exposing raw database errors to client
- Using `any` type to bypass TypeScript

## Testing commands

```bash
npm run lint        # ESLint
npm run build       # Production build
npx tsc --noEmit    # TypeScript check
bun run db:push     # Push schema to database
```

## Database deployment procedure

1. Update `prisma/schema.prisma`
2. Run `bun run db:generate`
3. Run `bun run db:push`
4. Update `supabase/database/schema.sql`
5. Apply in Supabase SQL Editor if needed

## Production deployment procedure

1. Push to GitHub main branch
2. Vercel auto-deploys
3. Verify environment variables in Vercel
4. Test auth flow
5. Test bootstrap flow
6. Monitor logs for errors

## Current project status

- Build: PASS
- TypeScript: PASS
- Lint: PASS (no new errors introduced)
- Bootstrap: Fixed with structured errors and Authorization header support
- Loading UX: Fixed with error state and retry
- Database schema: Canonical schema created
