# Venom CRM — Development

## Prerequisites

- Node.js 20+
- Bun or npm
- Supabase account
- PostgreSQL (via Supabase)

## Setup

```bash
# Clone repository
git clone <repo-url>
cd venom

# Install dependencies
bun install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials

# Push database schema
bun run db:push

# Start development server
bun run dev
```

## Database Development

### Prisma Schema

The Prisma schema is in `prisma/schema.prisma`. To regenerate the client after schema changes:

```bash
bun run db:generate
```

### Supabase Schema

The canonical SQL schema is in `supabase/database/schema.sql`. Apply it in the Supabase SQL Editor.

### Seeding Demo Data

```bash
bun run db:seed
```

This creates a demo workspace with sample users, companies, contacts, leads, deals, tasks, notes, and automations.

## Code Conventions

- TypeScript strict mode enabled
- Client components use `'use client'` directive
- Server components for data fetching where possible
- API routes use `NextResponse.json()` with `ok()` / `fail()` helpers
- All database queries go through Prisma
- Auth checks use `requireAuth()` / `requireWorkspace()` helpers

## Key Patterns

### API Route Handler

```typescript
export async function GET(req: Request) {
  try {
    const workspaceId = await requireWorkspace(req)
    const data = await db.lead.findMany({ where: { workspaceId } })
    return ok(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    return fail('Internal server error', 500)
  }
}
```

### Bootstrap Flow

1. Client calls `/api/crm/bootstrap` with Authorization header
2. Server verifies Supabase token or cookies
3. Server finds or creates `User` profile
4. Server finds or creates `Workspace` + `Membership`
5. Server creates default pipeline + stages if new workspace
6. Server returns user, workspace, members, tags

## Troubleshooting

### Database Connection Errors

- Verify `DATABASE_URL` is correct
- Check Supabase project is not paused
- Ensure IP allowlist includes your IP (if configured)

### Auth Issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check Supabase Auth settings (email confirmation, redirect URLs)
- Ensure cookies are not blocked in browser

### Build Errors

- Clear `.next` directory: `rm -rf .next`
- Regenerate Prisma client: `bun run db:generate`
- Check TypeScript: `npx tsc --noEmit`
