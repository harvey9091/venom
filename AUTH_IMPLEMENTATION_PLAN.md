# Venom CRM — Auth Implementation Plan

## 1. Supabase Auth Features to Implement

### Core Authentication
- **Signup**: Email/password signup with email verification
- **Login**: Email/password login with optional "Remember Me" (session persistence)
- **Forgot Password**: Request password reset email
- **Reset Password**: Set new password via email link
- **Email Verification**: Verify email before granting access
- **Logout**: Session teardown + cleanup

### Session Management
- **Session Persistence**: Use `@supabase/ssr` cookies for SSR-safe session handling
- **Refresh Tokens**: Automatic token refresh via `@supabase/ssr` middleware
- **Auto Login/Logout**: Detect session state changes and sync with app state
- **Protected Routes**: Redirect unauthenticated users to login
- **Middleware Auth**: Edge-level session validation + route protection

### Role-Based Access
- Read `membership.role` from DB after bootstrap
- Enforce `viewer` restrictions at API layer
- Redirect non-owners away from settings

---

## 2. New Files to Create

### Auth Pages (under `src/app/(auth)/`)
```
src/app/(auth)/login/page.tsx
src/app/(auth)/signup/page.tsx
src/app/(auth)/forgot-password/page.tsx
src/app/(auth)/reset-password/page.tsx
src/app/(auth)/auth-error/page.tsx
```
- Use route group `(auth)` to share layout with login shell
- Clean, minimal UI matching the existing design system

### Middleware
```
middleware.ts
```
- Reads Supabase session from cookies using `@supabase/ssr`
- Refreshes access token if needed
- Protects `/api/crm/*`, `/dashboard`, etc.
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from auth pages

### Server Auth Helpers
```
src/lib/auth/server.ts
src/lib/auth/client.ts
src/lib/auth/session.ts
```
- `server.ts`: Supabase server client with cookie helpers (`createServerClient`)
- `session.ts`: Helper to get current user + workspace from session in Server Components / API routes
- `client.ts`: Re-export of `createSupabaseBrowserClient` with auth helpers

### Client Auth Hook
```
src/hooks/use-auth.ts
```
- `useAuth()` — returns `{ user, session, loading, signIn, signUp, signOut, ... }`
- Listens to `onAuthStateChange` from Supabase
- Syncs auth state with `useAppStore`

### Auth API Routes
```
src/app/api/auth/callback/route.ts        # OAuth / email verification callback
src/app/api/auth/session/route.ts         # GET current session
src/app/api/auth/provision/route.ts       # POST — create workspace after signup
```
- Bootstrap endpoint will be auth-aware

### Auth UI Components
```
src/components/auth/login-form.tsx
src/components/auth/signup-form.tsx
src/components/auth/forgot-password-form.tsx
src/components/auth/reset-password-form.tsx
src/components/auth/auth-provider.tsx       # optional client wrapper
```
- Use existing shadcn/ui primitives (`Input`, `Button`, `Card`)
- Hook into `use-auth` hook

### Types Updates
```
src/lib/types.ts
```
Add:
```ts
export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
  user: User
}
```

---

## 3. Existing Files to Modify

### `src/lib/supabase.ts`
- Add `createSupabaseServerClient()` using `createServerClient` from `@supabase/ssr` (cookies)
- Keep `createSupabaseBrowserClient()` but rename/alias
- Remove manual `Authorization` header pattern — use SSR cookies instead

### `src/lib/api.ts`
- Add `requireAuth(req)` — reads Supabase session, returns `User` or 401
- Replace `getWorkspaceId` with auth-based workspace resolution
- Add auth error helpers: `unauthorized()`, `forbidden()`

### `src/components/providers.tsx`
- Add `<SupabaseProvider>` or integrate auth state into existing `IdentityBootstrap`
- Bootstrap flow:
  1. Check Supabase session
  2. If session exists → fetch user profile + workspace from `/api/crm/bootstrap` (now auth-aware)
  3. If no session → show login page or remain on public routes
  4. Show loading orb during resolution

### `src/lib/store.ts`
- Add `auth` slice:
  ```ts
  auth: {
    user: User | null
    session: Session | null
    isLoading: boolean
    setAuth: (user, session) => void
    clearAuth: () => void
    setLoading: (v) => void
  }
  ```

### `src/app/api/crm/bootstrap/route.ts`
- Replace unauthenticated first-user logic with Supabase session check
- Read `auth.uid()` from session
- Look up `users.auth_id` to find CRM profile
- If no profile exists for authenticated user, return 404 / redirect
- Dev fallback: keep seeded user but only if `NODE_ENV === 'development'`

### `src/app/layout.tsx`
- Optionally add metadata/robots for auth pages
- Ensure `suppressHydrationWarning` remains

### `src/app/page.tsx`
- Guard: redirect to `/dashboard` if authenticated, else show landing or redirect to login

### `src/lib/db.ts`
- No changes needed — Prisma already targets `public` schema

### API Routes (`src/app/api/crm/**`)
- Wrap protected routes with `requireAuth(req)`
- Replace `workspaceId` query param with workspace from user membership

---

## 4. Database Migration Needs

### Prisma Schema (`prisma/schema.prisma`)
- Add `authId` to `User` model as unique field mapping to `auth.users(id)`
  ```prisma
  model User {
    id        String   @id @default(uuid())
    authId    String?  @unique @map("auth_id")
    // ... existing fields
    @@schema("public")
  }
  ```
- No new tables needed — Supabase Auth manages `auth.users`, `auth.sessions`, etc.

### SQL Migration (`supabase/database/schema.sql`)
- The `public.users.auth_id` FK already exists
- Add `auth_id` NOT NULL constraint after migration:
  ```sql
  alter table public.users alter column auth_id set not null;
  ```
- Add trigger to auto-create `public.users` row on `auth.users` insert:
  ```sql
  create or replace function public.handle_new_auth_user()
  returns trigger
  language plpgsql
  security definer
  as $$
  begin
    insert into public.users (id, auth_id, email, name)
    values (new.id, new.id, new.email, '');
    return new;
  end;
  $$;

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();
  ```

### Post-Signup Workspace Provisioning
- Use Supabase Postgres function or Edge Function to create default workspace + membership after signup
- Or handle in Next.js API route (`/api/auth/provision`)

---

## 5. Environment Variables Needed

### `.env`
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Auth
NEXTAUTH_URL="http://localhost:3000"        # optional, if keeping next-auth for anything
NEXTAUTH_SECRET="your-nextauth-secret"       # optional

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### `.env.example` updates
- Keep existing Supabase vars
- Add `NEXT_PUBLIC_APP_URL`
- Mark NextAuth vars as optional/legacy

---

## 6. Step-by-Step Implementation Order

### Phase 1: Foundation
1. **Update `src/lib/supabase.ts`**
   - Replace with `@supabase/ssr` cookie-based clients
   - Export `createSupabaseServerClient`, `createSupabaseBrowserClient`

2. **Create `middleware.ts`**
   - Basic Supabase session refresh
   - Protect `/api/crm/*` and `/dashboard`
   - Redirect unauthenticated users to `/login`

3. **Create `src/lib/auth/server.ts`**
   - Helper to read user from session in Server Components / API routes
   - `getCurrentUser(req)` → returns `User | null`

### Phase 2: Auth API & State
4. **Create auth API routes**
   - `/api/auth/session` — GET current session
   - `/api/auth/callback` — handle email verification / OAuth callback

5. **Update `src/lib/api.ts`**
   - Add `requireAuth(req)` middleware
   - Add `unauthorized()`, `forbidden()` helpers

6. **Update `src/lib/store.ts`**
   - Add `auth` slice
   - Add `setAuth`, `clearAuth`, `setLoading`

7. **Create `src/hooks/use-auth.ts`**
   - Subscribe to `onAuthStateChange`
   - Sync with store

### Phase 3: Auth UI
8. **Create auth pages**
   - `(auth)/login/page.tsx`
   - `(auth)/signup/page.tsx`
   - `(auth)/forgot-password/page.tsx`
   - `(auth)/reset-password/page.tsx`

9. **Create auth form components**
   - `src/components/auth/login-form.tsx`
   - `src/components/auth/signup-form.tsx`
   - etc.

10. **Update `src/components/providers.tsx`**
    - Integrate auth bootstrap
    - Show login vs app based on auth state

### Phase 4: Bootstrap & Data Layer
11. **Update `/api/crm/bootstrap`**
    - Read Supabase session
    - Look up `users.auth_id`
    - Return workspace + memberships
    - Handle first-login provisioning via `/api/auth/provision`

12. **Create `/api/auth/provision`**
    - Called after signup
    - Creates workspace, membership, default pipeline

13. **Update Prisma schema**
    - Add `authId` field to `User`
    - Generate migration: `prisma migrate dev --name add-auth-id`

14. **Update SQL schema**
    - Add `auth_id NOT NULL` constraint
    - Add `handle_new_auth_user` trigger

### Phase 5: Polish
15. **Update existing API routes**
    - Wrap all `/api/crm/**` with `requireAuth`
    - Replace `workspaceId` query param with membership-derived workspace

16. **Update `src/app/page.tsx`**
    - Redirect authenticated users to `/dashboard`
    - Show public landing or redirect to `/login`

17. **Update `.env.example`**
    - Add `NEXT_PUBLIC_APP_URL`
    - Document Supabase Auth setup

18. **Testing**
    - Test signup flow
    - Test login/logout
    - Test password reset
    - Test protected routes
    - Test session refresh
    - Test RLS with real auth UID

---

## Critical Notes

- **Existing `next-auth` dependency**: Currently unused. Can be removed or kept for future OAuth integration. This plan uses Supabase Auth directly.
- **`@supabase/ssr` version 0.6.1**: Supports Next.js App Router with cookies. Ensure `createServerClient` is used in middleware and route handlers.
- **Prisma `auth` schema**: The datasource already references `schemas = ["public", "auth"]`, but no Prisma models exist for `auth.users`. Supabase Auth tables are managed by Supabase, not Prisma.
- **Dev mode fallback**: Keep the bootstrap seed logic behind `NODE_ENV === 'development'` so local dev still works without Supabase.
- **RLS**: The existing RLS policies reference `auth.uid()`. Once Supabase Auth is active, `auth.uid()` will return the real user UUID and policies will enforce workspace isolation automatically.
