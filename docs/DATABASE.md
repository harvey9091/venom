# Venom CRM — Database

## Connection

Database is Supabase PostgreSQL. Connection via Prisma ORM using `DATABASE_URL`.

```
postgresql://postgres:[password]@[host]:5432/postgres
```

## Schema Source of Truth

The canonical schema is in `supabase/database/schema.sql`. The Prisma schema in `prisma/schema.prisma` defines the ORM model.

## Tables

| Table | Purpose | Workspace Scoped |
|-------|---------|-----------------|
| `users` | Application user profiles (bridges auth.users) | No |
| `workspaces` | CRM workspaces/tenants | Yes (owner) |
| `memberships` | User-workspace relationships | Yes |
| `sessions` | Application sessions (not Supabase auth sessions) | No |
| `companies` | CRM companies | Yes |
| `contacts` | CRM contacts | Yes |
| `leads` | CRM leads | Yes |
| `pipelines` | Sales pipelines | Yes |
| `stages` | Pipeline stages | Yes (via pipeline) |
| `deals` | CRM deals | Yes |
| `tasks` | CRM tasks | Yes |
| `task_watchers` | Task watchers | Yes (via task) |
| `comments` | Task comments | Yes (via task) |
| `calendar_events` | Calendar events | Yes |
| `meetings` | Meeting records | Yes (via event) |
| `notes` | CRM notes | Yes |
| `files` | Uploaded files | Yes |
| `activities` | Activity log | Yes |
| `notifications` | User notifications | Yes |
| `tags` | Workspace tags | Yes |
| `entity_tags` | Polymorphic tag bindings | Yes |
| `custom_fields` | Custom entity fields | Yes |
| `automations` | Automation rules | Yes |
| `automation_logs` | Automation execution logs | Yes (via automation) |
| `audit_logs` | Audit trail | Yes |
| `api_keys` | API keys | Yes |
| `workspace_preferences` | Workspace settings | Yes |

## Key Relationships

```
auth.users (Supabase)
  └── public.users (auth_id FK)
       ├── memberships → workspaces
       ├── leads (owner/assignee)
       ├── deals (owner)
       ├── tasks (owner/assignee/creator)
       ├── contacts (via activities/meetings)
       └── ...

workspaces
  ├── memberships → users
  ├── companies
  ├── contacts
  ├── leads
  ├── pipelines → stages → deals
  ├── tasks
  ├── notes
  ├── activities
  ├── tags → entity_tags
  ├── custom_fields
  ├── automations → automation_logs
  ├── audit_logs
  ├── api_keys
  └── workspace_preferences
```

## RLS Policies

All workspace-scoped tables use the `current_user_workspace_ids()` function to determine access:

```sql
create policy "ws_leads_read" on public.leads for select
  using (workspace_id in (select public.current_user_workspace_ids()));
```

Members can read/write their workspace data. Owners can manage memberships and workspace settings.

## Indexes

Key indexes for query performance:

- `memberships(user_id, workspace_id)` - unique constraint + lookup
- `leads(workspace_id, status)` - filtered queries
- `deals(workspace_id, pipeline_id, stage_id)` - pipeline views
- `tasks(workspace_id, assignee_id, due_date)` - task queries
- `activities(workspace_id, created_at)` - activity feed
- `notifications(user_id, read)` - notification inbox

## Migrations

The project uses `prisma db push` for schema synchronization. The canonical SQL is in `supabase/database/schema.sql`.

To apply schema changes:
1. Update `prisma/schema.prisma`
2. Run `bun run db:push`
3. Update `supabase/database/schema.sql` to match

## Triggers

- `touch_updated_at()` - Auto-updates `updated_at` on specified tables
- No auto-deal creation trigger (handled in application code)
