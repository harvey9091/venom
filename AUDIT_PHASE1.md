# Venom CRM — Phase 1 Security & Architecture Audit

**Date:** 2026-08-06  
**Auditor:** Kilo  
**Scope:** `src/app/`, `src/lib/`, API routes, Prisma schema, Supabase schema, config files  

---

## Executive Summary

Venom CRM is a Next.js 16 SPA with a workspace-isolated Prisma + Supabase data layer and a rich TanStack Query client. The codebase is feature-rich but shipped with **no authentication, no authorization, no middleware, and no input validation**. All API routes trust `workspaceId` from the query string, and the bootstrap endpoint auto-provisions a hardcoded demo user when the database is empty. The Prisma schema and Supabase schema are out of sync, TypeScript build errors are suppressed, and critical security headers are missing. **This application is not safe for production in its current state.**

---

## Detailed Findings by Category

### 1. Missing Authentication / Authorization (CRITICAL)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1.1 | No authentication system exists. No `middleware.ts`, no login/signup pages, no session management. | **Critical** | Project-wide |
| 1.2 | `src/lib/api.ts` explicitly documents: "Reads workspaceId / userId from query string (since we're SPA without real auth)." | **Critical** | `src/lib/api.ts:3` |
| 1.3 | `bootstrap` route auto-creates a hardcoded user `dev@venom.crm` when DB is empty. No password, no verification. | **Critical** | `src/app/api/crm/bootstrap/route.ts:38-45` |
| 1.4 | `IdentityBootstrap` in `providers.tsx` calls `/api/crm/bootstrap` with no auth header. | **Critical** | `src/components/providers.tsx:43` |
| 1.5 | `settings` route exposes ALL users via `?section=users` without auth or workspace filtering. | **High** | `src/app/api/crm/settings/route.ts:24-27` |

### 2. Missing Middleware (CRITICAL)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 2.1 | No `middleware.ts` file exists. No route protection, no CORS, no rate limiting. | **Critical** | Missing file |
| 2.2 | API routes are fully open. Any unauthenticated caller can read/write any workspace data by guessing a `workspaceId`. | **Critical** | All `src/app/api/crm/**/route.ts` |

### 3. API Security Issues (CRITICAL)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 3.1 | `workspaceId` is accepted from the query string in every API route with no signature, cookie, or session verification. | **Critical** | `src/lib/api.ts:15-23`, all route files |
| 3.2 | `requireWorkspace` is a misnomer — it does not require anything, it just parses the query param. | **Critical** | `src/lib/api.ts:20-23` |
| 3.3 | No CSRF protection on state-changing endpoints (POST/PATCH/DELETE). | **High** | All mutation routes |
| 3.4 | No rate limiting or brute-force protection. | **High** | All routes |
| 3.5 | `notifications` route allows filtering by arbitrary `userId` and mass-updating (`markAllForUserId`) any user's notifications. | **High** | `src/app/api/crm/notifications/route.ts:7-9,19-21` |
| 3.6 | `settings` route `createApiKey` returns the raw API key in the JSON response. | **High** | `src/app/api/crm/settings/route.ts:57-67` |
| 3.7 | `settings` route `inviteMember` creates users with no password. | **High** | `src/app/api/crm/settings/route.ts:73-84` |
| 3.8 | `settings` route `deleteWorkspace` has no confirmation, no cascading checks, no admin-only guard. | **High** | `src/app/api/crm/settings/route.ts:121-124` |
| 3.9 | `pipelines` PATCH deletes all stages and recreates them (`deleteMany` + looped `create`). Race condition risk; no transaction. | **Medium** | `src/app/api/crm/pipelines/route.ts:36-42` |
| 3.10 | `leads` PATCH auto-syncs/side-effects creates deals without explicit authorization. | **Medium** | `src/app/api/crm/leads/route.ts:68-91` |
| 3.11 | `search` route runs unconstrained `contains` queries with no pagination, no timeout, no full-text index. | **Medium** | `src/app/api/crm/search/route.ts` |

### 4. Missing Auth Pages (CRITICAL)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 4.1 | No `/login`, `/signup`, `/forgot-password`, or `/auth/callback` routes. | **Critical** | Missing files |
| 4.2 | No protected route handling. Unauthenticated users see the full CRM UI with bootstrap-provisioned data. | **Critical** | `src/app/page.tsx` |

### 5. Database Concerns (HIGH)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 5.1 | Prisma schema (`prisma/schema.prisma`) is missing `authId` on `User`, which exists in the Supabase SQL schema. | **High** | `prisma/schema.prisma:24-33` vs `supabase/database/schema.sql:88-98` |
| 5.2 | Prisma schema lacks `entity_tags` table, which exists in Supabase SQL. | **High** | `prisma/schema.prisma` vs `supabase/database/schema.sql:353-360` |
| 5.3 | Prisma schema lacks `workspace_preferences` table, which exists in Supabase SQL. | **High** | `prisma/schema.prisma` vs `supabase/database/schema.sql:856-874` |
| 5.4 | Prisma `User` model has no `authId` field but Supabase schema references `auth.users(id)`. The two schemas cannot be used interchangeably. | **High** | Both schema files |
| 5.5 | `.env.example` uses SQLite (`DATABASE_URL="file:./db/custom.db"`) but the Prisma datasource targets PostgreSQL. | **High** | `.env.example:2`, `prisma/schema.prisma:14-18` |
| 5.6 | `entity_tags.entity_id` is intentionally not a FK in Supabase schema — orphaned tags possible. | **Medium** | `supabase/database/schema.sql:352-360` |
| 5.7 | Prisma `db.ts` logs every query in non-production (`log: ['query']`), which leaks SQL to console. | **Medium** | `src/lib/db.ts:9-11` |
| 5.8 | No database migration for the Supabase-specific tables. The raw SQL file must be run manually. | **Medium** | `supabase/database/schema.sql` |

### 6. Frontend Issues (MEDIUM)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 6.1 | No error boundaries. A single component crash will unmount the entire app. | **Medium** | Project-wide |
| 6.2 | TanStack Query hooks (`src/lib/hooks.ts`) do not check `!r.ok` before parsing JSON. Failed requests silently return `undefined`. | **Medium** | `src/lib/hooks.ts` (all `queryFn`) |
| 6.3 | `fetch` calls in hooks pass `workspaceId` in URL but have no fallback if `workspaceId` is null (though `enabled: !!ws` prevents execution). | **Low** | `src/lib/hooks.ts` |
| 6.4 | No optimistic update error rollback in mutations. | **Low** | `src/lib/hooks.ts` mutation hooks |
| 6.5 | `providers.tsx` bootstrap swallows errors: `setReady(true)` even on failure, leaving the app in a broken state with no user/workspace. | **Medium** | `src/components/providers.tsx:62-64` |
| 6.6 | `page.tsx` renders all views in a single component with conditional rendering. No route-level code splitting or error isolation. | **Low** | `src/app/page.tsx` |

### 7. TypeScript / ESLint Issues (MEDIUM)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 7.1 | `next.config.ts` sets `typescript.ignoreBuildErrors: true`, suppressing all type errors during `next build`. | **High** | `next.config.ts:5-7` |
| 7.2 | `any` casts used in `bootstrap` route (`(s as any).isWon`) and `leads` route (`lead: any`). | **Medium** | `src/app/api/crm/bootstrap/route.ts:83-84`, `src/app/api/crm/leads/route.ts:108` |
| 7.3 | ESLint config is not visible, but `ignoreBuildErrors` suggests lint errors may also be suppressed. | **Low** | `next.config.ts` |

### 8. Environment Variable Issues (MEDIUM)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 8.1 | `.env.example` uses SQLite but `prisma/schema.prisma` targets PostgreSQL. Developers will hit schema mismatch errors. | **High** | `.env.example:2`, `prisma/schema.prisma:14` |
| 8.2 | `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are present in `.env.example` but `next-auth` is not configured anywhere in the codebase. | **Medium** | `.env.example:10-11` |
| 8.3 | `SUPABASE_SERVICE_ROLE_KEY` is in `.env.example` but server-side usage is inconsistent (some routes read `NEXT_PUBLIC_*`, others read server vars). | **Medium** | `.env.example:7`, various route files |
| 8.4 | AI provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are exposed in `integrations` route responses with only partial masking. | **Medium** | `src/app/api/crm/integrations/route.ts:23-27,61-93` |

### 9. Missing Error Handling (MEDIUM)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 9.1 | API routes lack `try/catch`. Prisma errors (e.g., unique constraint violations) return 500 with stack traces. | **Medium** | All `src/app/api/crm/**/route.ts` |
| 9.2 | `dashboard` route does `wonDeals.filter(...)` then `.reduce(...)` — if `stage` is null, `stage.isWon` throws. | **Medium** | `src/app/api/crm/dashboard/route.ts:50-55` |
| 9.3 | `bootstrap` route catches errors but sets `ready = true`, causing the app to render without user/workspace. | **Medium** | `src/components/providers.tsx:62-64` |
| 9.4 | No 404/500 error pages. Next.js default pages will show raw error stack in development. | **Low** | `src/app` |

### 10. Missing Loading / Empty States (MEDIUM)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 10.1 | TanStack Query hooks return raw data with no `isLoading`, `isError`, or `data` guards in consuming components. | **Medium** | `src/lib/hooks.ts` + view components |
| 10.2 | `bootstrap` shows an animated orb but has no retry/recovery UI if provisioning fails. | **Low** | `src/components/providers.tsx:72-94` |

### 11. Mobile Responsiveness (LOW)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 11.1 | CSS has responsive padding tokens but no evidence of mobile-specific layout adaptations (sidebar, tables, drawers). | **Low** | `src/app/globals.css:469-496` |
| 11.2 | No viewport meta tag issues, but dense tables (`venom-table`) will overflow on small screens without horizontal scroll containers. | **Low** | `src/app/globals.css:585-607` |

### 12. Vercel / Deployment Security (MEDIUM)

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 12.1 | `vercel.json` is missing `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy`, and `X-XSS-Protection`. | **Medium** | `vercel.json:7-15` |
| 12.2 | `next.config.ts` `output: "standalone"` is correct for Vercel, but `ignoreBuildErrors: true` means broken builds can still deploy. | **Medium** | `next.config.ts:3-9` |
| 12.3 | `package.json` `start` script uses `NODE_ENV=production node ...` which is invalid on Windows (the project's `platform: win32`). | **Medium** | `package.json:8` |

---

## Top 10 Critical Issues (Summary)

1. **No authentication or authorization at all.** Every API route is open to the public. Any caller can read, create, update, or delete any workspace's data by supplying a guessed `workspaceId` in the query string.

2. **No middleware.** There is no `middleware.ts`, no route guards, no CORS policy, and no rate limiting. The entire API surface is unprotected.

3. **`workspaceId` from query string is trusted as the sole tenancy mechanism.** There is no session, cookie, JWT, or service-role verification. Cross-workspace data access is trivially achievable.

4. **Hardcoded auto-provisioned demo user.** The `bootstrap` endpoint creates `dev@venom.crm` with no password when the database is empty. This is a permanent backdoor in any environment where seeding hasn't run.

5. **TypeScript build errors are suppressed.** `next.config.ts` sets `typescript.ignoreBuildErrors: true`, meaning type mismatches, missing properties, and broken code will never block a production deploy.

6. **Prisma and Supabase schemas are out of sync.** The Prisma schema is missing `authId` on `User`, `entity_tags`, and `workspace_preferences`. The app cannot be reliably deployed against either schema without manual reconciliation.

7. **SQLite vs PostgreSQL mismatch in `.env.example`.** The example env points to SQLite while the Prisma datasource and Supabase schema target PostgreSQL, guaranteeing onboarding friction and runtime errors.

8. **API key creation returns the raw key.** The `settings` route returns `rawKey` in the JSON response, which is then lost. There is no way for the user to retrieve it again, and it is exposed in any logs or proxies.

9. **Critical security headers are missing.** `vercel.json` lacks `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy`, and `X-XSS-Protection`.

10. **Bootstrap error handling is broken.** On failure, `IdentityBootstrap` sets `ready = true` without a user or workspace, causing the app to render in a broken state with no recovery UI.

---

## Recommended Fixes

1. **Implement authentication immediately.** Use NextAuth v4 (already in `package.json`) or Supabase Auth. Add a `middleware.ts` that validates sessions on every `/api/crm/*` request.
2. **Replace query-string `workspaceId` with session-derived workspace resolution.** Never trust client input for tenancy.
3. **Add role-based access control (RBAC).** Enforce `owner` / `admin` / `member` / `viewer` roles at the API layer. Viewers should not be able to write.
4. **Remove auto-provisioning from `bootstrap`.** Require signup for production. Keep a separate seed script for local dev.
5. **Remove `ignoreBuildErrors`.** Fix all TypeScript errors before shipping.
6. **Reconcile Prisma and Supabase schemas.** Pick one source of truth. If using Prisma, drop the raw SQL file. If using Supabase migrations, generate Prisma from the database.
7. **Fix `.env.example`.** Point `DATABASE_URL` to PostgreSQL. Remove stale `NEXTAUTH_*` vars if not using NextAuth, or wire up NextAuth if keeping them.
8. **Add input validation.** Use Zod (already in `dependencies`) to validate all request bodies and query params.
9. **Add `try/catch` to all API routes** and return consistent error shapes. Log exceptions server-side, never expose stack traces to clients.
10. **Add security headers.** Update `vercel.json` with `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy`, and `X-XSS-Protection`.
11. **Fix Windows `start` script.** Use `cross-env` or PowerShell-compatible syntax.
12. **Disable Prisma query logging in production** or restrict it to `['error']`.
13. **Add pagination** to `activities`, `notifications`, and `search` endpoints.
14. **Add proper error boundaries** and loading/empty states in the frontend.
