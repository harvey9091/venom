# Venom CRM

Premium, enterprise-grade CRM for modern sales teams. Built with Next.js 16, React 19, TypeScript, Supabase, and Prisma.

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui
- **Auth**: Supabase Auth
- **Database**: Supabase PostgreSQL (via Prisma ORM)
- **State**: Zustand, TanStack Query
- **Deploy**: Vercel

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations
bun run db:push

# Start dev server
bun run dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start dev server on port 3000 |
| `build` | Production build |
| `start` | Start production server |
| `lint` | Run ESLint |
| `db:push` | Push Prisma schema to database |
| `db:generate` | Generate Prisma client |
| `db:seed` | Seed demo data |

## Project Structure

```
src/
  app/                    # Next.js App Router
    (auth)/               # Authentication pages
    api/                  # API routes
      auth/               # Auth endpoints
      crm/                # CRM API endpoints
  components/
    auth/                 # Auth components
    crm/                  # CRM components
    ui/                   # shadcn/ui components
  hooks/                  # React hooks
  lib/                    # Utilities, clients, auth
public/                   # Static assets
supabase/
  database/
    schema.sql            # Canonical database schema
prisma/
  schema.prisma           # Prisma ORM schema
docs/                     # Documentation
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Database](./docs/DATABASE.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Development](./docs/DEVELOPMENT.md)
- [Project Context](./PROJECT_CONTEXT.md)
- [AI Context](./AI_CONTEXT.md)
- [Roadmap](./PROJECT_ROADMAP.md)
