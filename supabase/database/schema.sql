-- =============================================================
--  VENOM CRM — Canonical Supabase/PostgreSQL Schema
--  Source of truth: prisma/schema.prisma
--  Execute in Supabase SQL Editor on a clean database.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Extensions
-- -------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 2. Tables
-- -------------------------------------------------------------

create table if not exists public.users (
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

create table if not exists public.workspaces (
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

create table if not exists public.memberships (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role         text default 'member',
  joined_at    timestamptz default now(),
  unique (user_id, workspace_id)
);

create table if not exists public.companies (
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

create table if not exists public.contacts (
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

create table if not exists public.leads (
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

create table if not exists public.pipelines (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  is_default   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists public.stages (
  id           uuid primary key default uuid_generate_v4(),
  pipeline_id  uuid not null references public.pipelines(id) on delete cascade,
  name         text not null,
  color        text default '#64748b',
  "order"      integer not null,
  probability  integer default 20,
  is_won       boolean default false,
  is_lost      boolean default false
);

create table if not exists public.deals (
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

create table if not exists public.tasks (
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

create table if not exists public.task_watchers (
  id        uuid primary key default uuid_generate_v4(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  unique (task_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

create table if not exists public.calendar_events (
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

create table if not exists public.meetings (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null references public.calendar_events(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  host_id    uuid not null references public.users(id) on delete cascade,
  outcome    text,
  notes      text,
  created_at timestamptz default now()
);

create table if not exists public.notes (
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

create table if not exists public.files (
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

create table if not exists public.activities (
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

create table if not exists public.notifications (
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

create table if not exists public.tags (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  color        text default '#64748b',
  created_at   timestamptz default now(),
  unique (workspace_id, name)
);

create table if not exists public.entity_tags (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  created_at  timestamptz default now()
);

create table if not exists public.custom_fields (
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

create table if not exists public.automations (
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

create table if not exists public.automation_logs (
  id           uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  status       text not null,
  detail       text,
  created_at   timestamptz default now()
);

create table if not exists public.audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  meta         jsonb,
  created_at   timestamptz default now()
);

create table if not exists public.api_keys (
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

create table if not exists public.workspace_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  nav_mode     text default 'sidebar',
  updated_at   timestamptz default now()
);

-- Back-reference: leads.converted_deal_id -> deals.id
do $$ begin
  alter table public.leads
    add constraint leads_converted_deal_id_fkey
    foreign key (converted_deal_id) references public.deals(id) on delete set null;
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 3. Indexes
-- -------------------------------------------------------------

create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_workspace on public.memberships(workspace_id);
create index if not exists idx_companies_workspace on public.companies(workspace_id);
create index if not exists idx_contacts_workspace on public.contacts(workspace_id);
create index if not exists idx_contacts_company on public.contacts(company_id);
create index if not exists idx_leads_workspace on public.leads(workspace_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_owner on public.leads(owner_id);
create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_deals_workspace on public.deals(workspace_id);
create index if not exists idx_deals_pipeline on public.deals(pipeline_id);
create index if not exists idx_deals_stage on public.deals(stage_id);
create index if not exists idx_deals_owner on public.deals(owner_id);
create index if not exists idx_tasks_workspace on public.tasks(workspace_id);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_parent on public.tasks(parent_task_id);
create index if not exists idx_notes_workspace on public.notes(workspace_id);
create index if not exists idx_notes_lead on public.notes(lead_id);
create index if not exists idx_activities_workspace on public.activities(workspace_id);
create index if not exists idx_activities_created on public.activities(created_at desc);
create index if not exists idx_notifications_user on public.notifications(user_id, read);
create index if not exists idx_entity_tags_entity on public.entity_tags(entity_type, entity_id);
create index if not exists idx_audit_logs_workspace on public.audit_logs(workspace_id, created_at desc);
create index if not exists idx_calendar_events_workspace on public.calendar_events(workspace_id, start_at);
create index if not exists idx_stages_pipeline on public.stages(pipeline_id, "order");
create index if not exists idx_tags_workspace on public.tags(workspace_id);
create index if not exists idx_custom_fields_workspace on public.custom_fields(workspace_id);
create index if not exists idx_entity_tags_workspace on public.entity_tags(workspace_id);
create index if not exists idx_activities_lead on public.activities(lead_id);
create index if not exists idx_activities_deal on public.activities(deal_id);
create index if not exists idx_workspace_prefs on public.workspace_preferences(workspace_id);

-- -------------------------------------------------------------
-- 4. RLS Policies
-- -------------------------------------------------------------

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

-- Helper: get the current user's workspace IDs
create or replace function public.current_user_workspace_ids()
returns setof uuid
language sql
security definer
as $$
  select workspace_id from public.memberships m
  join public.users u on u.id = m.user_id
  where u.auth_id = auth.uid();
$$;

-- Users can read their own profile
create policy "users_self_read" on public.users for select using (auth_id = auth.uid());
create policy "users_self_update" on public.users for update using (auth_id = auth.uid());

-- Workspaces: members can read, only owners can update
create policy "workspaces_member_read" on public.workspaces for select
  using (id in (select public.current_user_workspace_ids()));
create policy "workspaces_owner_update" on public.workspaces for update
  using (id in (select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role = 'owner'));

-- Memberships: workspace members can read; owners can manage
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

-- All workspace-scoped tables: members can read/write
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

create policy "ws_automation_logs_read" on public.automation_logs for select
  using (automation_id in (
    select id from public.automations
    where workspace_id in (select public.current_user_workspace_ids())
  ));

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

create policy "comments_read" on public.comments for select
  using (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())));
create policy "comments_write" on public.comments for all
  using (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())))
  with check (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())));

create policy "ws_prefs_read" on public.workspace_preferences for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_prefs_write" on public.workspace_preferences for update
  using (workspace_id in (select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role in ('owner', 'admin')))
  with check (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_prefs_insert" on public.workspace_preferences for insert
  with check (workspace_id in (select public.current_user_workspace_ids()));

-- -------------------------------------------------------------
-- 5. Triggers — updated_at auto-maintenance
-- -------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare tbl text;
begin
  for tbl in
    select unnest(array['users','workspaces','memberships','companies','contacts','leads','pipelines','stages','deals','tasks','notes','calendar_events','automations','workspace_preferences'])
  loop
    execute format('drop trigger if exists trg_%s_touch on public.%s', tbl, tbl);
    execute format('create trigger trg_%s_touch before update on public.%s for each row execute function public.touch_updated_at();', tbl, tbl);
  end loop;
end $$;

-- -------------------------------------------------------------
-- 6. Functions
-- -------------------------------------------------------------

create or replace function public.upsert_nav_mode(ws_uuid uuid, mode text)
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

-- Restrict execution to authenticated users only
revoke execute on function public.upsert_nav_mode(uuid, text) from public;
grant execute on function public.upsert_nav_mode(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 7. Realtime publication
-- -------------------------------------------------------------

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

-- -------------------------------------------------------------
-- 8. Storage buckets
-- -------------------------------------------------------------
-- NOTE: Application does not currently use Supabase Storage.
-- File URLs are stored as text in the files table.
-- Storage configuration is omitted to avoid unused, insecure policies.
-- If file upload via Supabase Storage is implemented later,
-- add workspace-scoped policies here.
