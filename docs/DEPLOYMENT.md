# Venom CRM — Deployment

## Vercel Deployment

The application is configured for Vercel deployment via `vercel.json`.

### Environment Variables (Vercel)

Required in Vercel project settings:

```
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NEXT_PUBLIC_APP_URL=https://[app-url].vercel.app
```

### Build Settings

- Build command: `next build`
- Output: Standalone
- Node version: 20+
- Install: `bun install` or `npm install`

### Security Headers

Configured in `vercel.json`:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- X-XSS-Protection
- Permissions-Policy
- Content-Security-Policy

## Supabase Setup

1. Create Supabase project
2. Run `supabase/database/schema.sql` in SQL Editor
3. Configure Auth providers (email/password)
4. Set up storage buckets (optional):
   - `venom-files`
   - `venom-avatars`
   - `venom-workspace-logos`
5. Configure redirect URLs in Supabase Auth settings

## Database Setup

```bash
# Push schema to database
bun run db:push

# Optional: seed demo data
bun run db:seed
```

## Production Checklist

- [ ] Supabase project created and schema applied
- [ ] Environment variables configured in Vercel
- [ ] Auth redirect URLs configured in Supabase
- [ ] Storage buckets created (if using file uploads)
- [ ] Database backups enabled
- [ ] RLS policies verified
- [ ] Rate limiting tested
- [ ] Error monitoring configured
