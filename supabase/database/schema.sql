-- =============================================================
--  VENOM CRM — Canonical Supabase/PostgreSQL Schema
--  TRUE FROM-SCRATCH INSTALLER
--  Execute in Supabase SQL Editor. Safe to re-run.
-- =============================================================

-- =============================================================
-- 1. EXTENSIONS
-- =============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
-- 2. RESET — drop all Venom CRM application objects
-- =============================================================
-- Only touches Venom CRM objects in public schema.
-- Does NOT touch auth.users, Supabase system schemas, or
-- anything outside the application's own database objects.
--
-- WARNING: This deletes all existing Venom CRM application data.
--
-- Correct dependency order:
--   1. Drop tables first (CASCADE removes policies, triggers, indexes, FKs)
--   2. Then drop functions (no remaining dependent objects)

DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.automations CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.workspace_preferences CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.custom_fields CASCADE;
DROP TABLE IF EXISTS public.entity_tags CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.meetings CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.task_watchers CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.stages CASCADE;
DROP TABLE IF EXISTS public.pipelines CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Now safe to drop functions (tables/policies/triggers already removed)
DROP FUNCTION IF EXISTS public.touch_updated_at();
DROP FUNCTION IF EXISTS public.upsert_nav_mode(uuid, text);
DROP FUNCTION IF EXISTS public.current_user_workspace_ids();

-- =============================================================
-- 3. TABLES
-- =============================================================

create table public.users (
  id          uuid primary key default uuid_generate_v4(),
  auth_id     uuid unique references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text not null,
  avatar_url  text,
  job_title   text,
  locale      text default 'en',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.workspaces (
  id            uuid primary key default uuid_generate_v4(),
  slug          text unique not null,
  name          text not null,
  description   text,
  logo_url      text,
  accent_color  text default '#6366f1',
  plan          text default 'free',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table public.memberships (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role         text default 'member',
  joined_at    timestamptz default now(),
  unique (user_id, workspace_id)
);

create table public.companies (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  domain       text,
  industry     text,
  size         text,
  revenue      double precision,
  website      text,
  logo_url     text,
  address      text,
  city         text,
  country      text,
  description  text,
  status       text default 'active',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.contacts (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete set null,
  first_name   text not null,
  last_name    text,
  email        text,
  phone        text,
  job_title    text,
  avatar_url   text,
  linkedin     text,
  twitter      text,
  status       text default 'subscribed',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.leads (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  company_id      uuid references public.companies(id) on delete set null,
  owner_id        uuid references public.users(id) on delete set null,
  assigned_user_id uuid references public.users(id) on delete set null,
  full_name       text not null,
  email           text,
  phone           text,
  source          text,
  status          text default 'new',
  score           integer default 0,
  estimated_value double precision,
  expected_close  timestamptz,
  converted_deal_id uuid unique,
  last_activity_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table public.pipelines (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  is_default   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.stages (
  id           uuid primary key default uuid_generate_v4(),
  pipeline_id  uuid not null references public.pipelines(id) on delete cascade,
  name         text not null,
  color        text default '#64748b',
  "order"      integer not null,
  probability  integer default 20,
  is_won       boolean default false,
  is_lost      boolean default false
);

create table public.deals (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  pipeline_id    uuid not null references public.pipelines(id) on delete cascade,
  stage_id       uuid not null references public.stages(id) on delete cascade,
  contact_id     uuid references public.contacts(id) on delete set null,
  company_id     uuid references public.companies(id) on delete set null,
  owner_id       uuid references public.users(id) on delete set null,
  title          text not null,
  amount         double precision default 0,
  currency       text default 'INR',
  probability    integer default 20,
  expected_close timestamptz,
  closed_at      timestamptz,
  close_reason   text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table public.tasks (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete set null,
  title         text not null,
  description   text,
  status        text default 'todo',
  priority      text default 'medium',
  owner_id      uuid references public.users(id) on delete set null,
  assignee_id   uuid references public.users(id) on delete set null,
  creator_id    uuid references public.users(id) on delete cascade,
  due_date      timestamptz,
  start_date    timestamptz,
  recurrence    text,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  "order"       integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table public.task_watchers (
  id        uuid primary key default uuid_generate_v4(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  unique (task_id, user_id)
);

create table public.comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

create table public.calendar_events (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  description  text,
  type         text default 'meeting',
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  all_day      boolean default false,
  location     text,
  meeting_link text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.meetings (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null references public.calendar_events(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  host_id    uuid not null references public.users(id) on delete cascade,
  outcome    text,
  notes      text,
  created_at timestamptz default now()
);

create table public.notes (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id    uuid not null references public.users(id) on delete cascade,
  lead_id      uuid references public.leads(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete set null,
  deal_id      uuid references public.deals(id) on delete set null,
  company_id   uuid references public.companies(id) on delete set null,
  title        text,
  body         text not null,
  pinned       boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.files (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploader_id  uuid references public.users(id) on delete set null,
  note_id      uuid references public.notes(id) on delete set null,
  lead_id      uuid references public.leads(id) on delete set null,
  contact_id   uuid references public.contacts(id) on delete set null,
  deal_id      uuid references public.deals(id) on delete set null,
  company_id   uuid references public.companies(id) on delete set null,
  name         text not null,
  mime_type    text not null,
  size         bigint not null,
  url          text not null,
  version      integer default 1,
  created_at   timestamptz default now()
);

create table public.activities (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  lead_id      uuid references public.leads(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete set null,
  deal_id      uuid references public.deals(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete set null,
  type         text not null,
  summary      text not null,
  meta         jsonb,
  created_at   timestamptz default now()
);

create table public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  link         text,
  read         boolean default false,
  created_at   timestamptz default now()
);

create table public.tags (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  color        text default '#64748b',
  created_at   timestamptz default now(),
  unique (workspace_id, name)
);

create table public.entity_tags (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  created_at  timestamptz default now()
);

create table public.custom_fields (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type  text not null,
  name         text not null,
  key          text not null,
  type         text not null,
  options      jsonb,
  required     boolean default false,
  created_at   timestamptz default now(),
  unique (workspace_id, entity_type, key)
);

create table public.automations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  enabled       boolean default true,
  trigger_type  text not null,
  trigger_config jsonb,
  graph         jsonb not null,
  runs_count    integer default 0,
  last_run_at   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table public.automation_logs (
  id           uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  status       text not null,
  detail       text,
  created_at   timestamptz default now()
);

create table public.audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  meta         jsonb,
  created_at   timestamptz default now()
);

create table public.api_keys (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id   uuid not null references public.users(id) on delete cascade,
  name         text not null,
  prefix       text not null,
  hashed_key   text unique not null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz default now()
);

create table public.workspace_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  nav_mode     text default 'sidebar',
  updated_at   timestamptz default now()
);

-- Back-reference: leads.converted_deal_id -> deals.id
do $$ begin
  alter table public.leads
    add constraint leads_converted_deal_id_fkey
    foreign key (converted_deal_id) references public.deals(id) on delete set null;
  exception when duplicate_object then null;
end $$;

-- =============================================================
-- 4. INDEXES
-- =============================================================

create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_workspace on public.memberships(workspace_id);
create index idx_companies_workspace on public.companies(workspace_id);
create index idx_contacts_workspace on public.contacts(workspace_id);
create index idx_contacts_company on public.contacts(company_id);
create index idx_leads_workspace on public.leads(workspace_id);
create index idx_leads_status on public.leads(status);
create index idx_leads_owner on public.leads(owner_id);
create index idx_leads_email on public.leads(email);
create index idx_deals_workspace on public.deals(workspace_id);
create index idx_deals_pipeline on public.deals(pipeline_id);
create index idx_deals_stage on public.deals(stage_id);
create index idx_deals_owner on public.deals(owner_id);
create index idx_tasks_workspace on public.tasks(workspace_id);
create index idx_tasks_assignee on public.tasks(assignee_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_parent on public.tasks(parent_task_id);
create index idx_notes_workspace on public.notes(workspace_id);
create index idx_notes_lead on public.notes(lead_id);
create index idx_activities_workspace on public.activities(workspace_id);
create index idx_activities_created on public.activities(created_at desc);
create index idx_notifications_user on public.notifications(user_id, read);
create index idx_entity_tags_entity on public.entity_tags(entity_type, entity_id);
create index idx_audit_logs_workspace on public.audit_logs(workspace_id, created_at desc);
create index idx_calendar_events_workspace on public.calendar_events(workspace_id, start_at);
create index idx_stages_pipeline on public.stages(pipeline_id, "order");
create index idx_tags_workspace on public.tags(workspace_id);
create index idx_custom_fields_workspace on public.custom_fields(workspace_id);
create index idx_entity_tags_workspace on public.entity_tags(workspace_id);
create index idx_activities_lead on public.activities(lead_id);
create index idx_activities_deal on public.activities(deal_id);
create index idx_workspace_prefs on public.workspace_preferences(workspace_id);

-- =============================================================
-- 5. FUNCTIONS
-- =============================================================

create function public.current_user_workspace_ids()
returns setof uuid
language sql
security definer
as $$
  select workspace_id from public.memberships m
  join public.users u on u.id = m.user_id
  where u.auth_id = auth.uid();
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.upsert_nav_mode(ws_uuid uuid, mode text)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid()
      and m.workspace_id = ws_uuid
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Forbidden: workspace owner or admin required';
  end if;

  insert into public.workspace_preferences (workspace_id, nav_mode)
  values (ws_uuid, mode)
  on conflict (workspace_id) do update set nav_mode = excluded.nav_mode, updated_at = now();
end;
$$;

revoke execute on function public.upsert_nav_mode(uuid, text) from public;
grant execute on function public.upsert_nav_mode(uuid, text) to authenticated;

-- =============================================================
-- 6. TRIGGERS
-- =============================================================

do $$
declare tbl text;
begin
  for tbl in
    select unnest(array['users','workspaces','memberships','companies','contacts','leads','pipelines','stages','deals','tasks','notes','calendar_events','automations','workspace_preferences'])
  loop
    execute format('create trigger trg_%s_touch before update on public.%s for each row execute function public.touch_updated_at();', tbl, tbl);
  end loop;
end $$;

-- =============================================================
-- 7. RLS ENABLEMENT
-- =============================================================

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.pipelines enable row level security;
alter table public.stages enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;
alter table public.task_watchers enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.meetings enable row level security;
alter table public.notes enable row level security;
alter table public.files enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.tags enable row level security;
alter table public.entity_tags enable row level security;
alter table public.custom_fields enable row level security;
alter table public.automations enable row level security;
alter table public.automation_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_keys enable row level security;
alter table public.workspace_preferences enable row level security;

-- =============================================================
-- 8. RLS POLICIES
-- =============================================================

-- Users
create policy "users_self_read" on public.users for select
  using (auth_id = auth.uid());
create policy "users_self_update" on public.users for update
  using (auth_id = auth.uid());

-- Workspaces
create policy "workspaces_member_read" on public.workspaces for select
  using (id in (select public.current_user_workspace_ids()));
create policy "workspaces_owner_update" on public.workspaces for update
  using (id in (select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role = 'owner'));

-- Memberships
create policy "memberships_member_read" on public.memberships for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "memberships_owner_write" on public.memberships for all
  using (workspace_id in (
    select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role = 'owner'
  ))
  with check (workspace_id in (
    select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role = 'owner'
  ));

-- Workspace-scoped tables: members can read/write
create policy "ws_companies_read" on public.companies for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_companies_write" on public.companies for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_contacts_read" on public.contacts for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_contacts_write" on public.contacts for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_leads_read" on public.leads for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_leads_write" on public.leads for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_pipelines_read" on public.pipelines for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_pipelines_write" on public.pipelines for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_stages_read" on public.stages for select
  using (pipeline_id in (select id from public.pipelines where workspace_id in (select public.current_user_workspace_ids())));
create policy "ws_stages_write" on public.stages for all
  using (pipeline_id in (select id from public.pipelines where workspace_id in (select public.current_user_workspace_ids())))
  with check (pipeline_id in (select id from public.pipelines where workspace_id in (select public.current_user_workspace_ids())));

create policy "ws_deals_read" on public.deals for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_deals_write" on public.deals for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_tasks_read" on public.tasks for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_tasks_write" on public.tasks for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_notes_read" on public.notes for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_notes_write" on public.notes for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_files_read" on public.files for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_files_write" on public.files for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_activities_read" on public.activities for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_activities_write" on public.activities for insert
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_notifications_read" on public.notifications for select
  using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "ws_notifications_write" on public.notifications for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));
create policy "notifications_self_update" on public.notifications for update
  using (user_id in (select id from public.users where auth_id = auth.uid()));

create policy "ws_tags_read" on public.tags for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_tags_write" on public.tags for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_entity_tags_read" on public.entity_tags for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_entity_tags_write" on public.entity_tags for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_custom_fields_read" on public.custom_fields for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_custom_fields_write" on public.custom_fields for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_automations_read" on public.automations for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_automations_write" on public.automations for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_audit_logs_read" on public.audit_logs for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_audit_logs_write" on public.audit_logs for insert
  with check (workspace_id in (select public.current_user_workspace_ids()));

-- API keys — explicit per-action policies, NO FOR ALL
create policy "ws_api_keys_read" on public.api_keys for select
  using (workspace_id in (
    select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role in ('owner', 'admin')
  ));
create policy "ws_api_keys_insert" on public.api_keys for insert
  with check (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_api_keys_update" on public.api_keys for update
  using (workspace_id in (
    select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role in ('owner', 'admin')
  ))
  with check (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_api_keys_delete" on public.api_keys for delete
  using (workspace_id in (
    select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role = 'owner'
  ));

-- Automation logs — workspace-isolated read via automation ownership
create policy "ws_automation_logs_read" on public.automation_logs for select
  using (automation_id in (
    select id from public.automations
    where workspace_id in (select public.current_user_workspace_ids())
  ));

-- Calendar / meetings
create policy "ws_calendar_read" on public.calendar_events for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_calendar_write" on public.calendar_events for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_meetings_read" on public.meetings for select
  using (event_id in (select id from public.calendar_events where workspace_id in (select public.current_user_workspace_ids())));
create policy "ws_meetings_write" on public.meetings for all
  using (event_id in (select id from public.calendar_events where workspace_id in (select public.current_user_workspace_ids())))
  with check (event_id in (select id from public.calendar_events where workspace_id in (select public.current_user_workspace_ids())));

-- Comments
create policy "comments_read" on public.comments for select
  using (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())));
create policy "comments_write" on public.comments for all
  using (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())))
  with check (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())));

-- Workspace preferences
create policy "ws_prefs_read" on public.workspace_preferences for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_prefs_write" on public.workspace_preferences for update
  using (workspace_id in (select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role in ('owner', 'admin')))
  with check (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_prefs_insert" on public.workspace_preferences for insert
  with check (workspace_id in (select public.current_user_workspace_ids()));

-- =============================================================
-- 9. REALTIME PUBLICATION
-- =============================================================

do $$
declare tbl text;
begin
  for tbl in
    select unnest(array['leads','deals','tasks','notes','activities','notifications','calendar_events','automations'])
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%s', tbl);
    exception when others then null;
    end;
  end loop;
end $$;
