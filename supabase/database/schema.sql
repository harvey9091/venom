-- =============================================================
--  VENOM CRM — Supabase PostgreSQL Schema
--  Production-ready SQL. Execute directly in Supabase SQL Editor.
--
--  Contents:
--    1.  Extensions
--    2.  Enums
--    3.  Tables
--    4.  Indexes
--    5.  Foreign Keys
--    6.  RLS Policies (workspace isolation)
--    7.  Triggers (updated_at, auto-deal creation)
--    8.  Views (dashboard aggregates)
--    9.  Functions (auto-deal, lead_score)
--    10. Realtime publication
--    11. Storage buckets
-- =============================================================

-- -------------------------------------------------------------
-- 1. Extensions
-- -------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 2. Enums
-- -------------------------------------------------------------
do $$ begin
  create type workspace_plan as enum ('free', 'pro', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum (
    'new', 'contacted', 'qualified', 'unqualified',
    'proposal_sent', 'negotiation', 'won', 'lost', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_source as enum ('website', 'referral', 'ads', 'cold_outreach', 'event', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'done', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_close_reason as enum ('won', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('mention', 'assignment', 'automation', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_log_status as enum ('success', 'failed', 'running');
exception when duplicate_object then null; end $$;

do $$ begin
  create type custom_field_type as enum ('text', 'number', 'date', 'select', 'multiselect', 'boolean', 'url');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_type as enum ('lead', 'contact', 'deal', 'company', 'task', 'note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type calendar_event_type as enum ('meeting', 'call', 'task', 'reminder', 'out_of_office');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_outcome as enum ('scheduled', 'completed', 'canceled', 'no_show');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 3. Tables
-- -------------------------------------------------------------

-- Users (mirrors auth.users but holds CRM profile data)
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
  accent_color  text default '#d4a373',
  plan          workspace_plan default 'free',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.memberships (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role         membership_role default 'member',
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
  source          lead_source,
  status          lead_status default 'new',
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
  close_reason   deal_close_reason,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Back-reference: lead.converted_deal_id → deals.id
do $$ begin
  alter table public.leads
    add constraint leads_converted_deal_id_fkey
    foreign key (converted_deal_id) references public.deals(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.tasks (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete set null,
  title         text not null,
  description   text,
  status        task_status default 'todo',
  priority      task_priority default 'medium',
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
  type         calendar_event_type default 'meeting',
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
  outcome    meeting_outcome,
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
  company_id   uuid references public.companies(id) on delete cascade,
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
  company_id   uuid references public.companies(id) on delete cascade,
  type         text not null,
  summary      text not null,
  meta         jsonb,
  created_at   timestamptz default now()
);

create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  type         notification_type not null,
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

-- Polymorphic tag bindings (entity_id is NOT a FK — resolved at app layer)
create table if not exists public.entity_tags (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity_type entity_type not null,
  entity_id   uuid not null,
  created_at  timestamptz default now()
);

create table if not exists public.custom_fields (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type  entity_type not null,
  name         text not null,
  key          text not null,
  type         custom_field_type not null,
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
  id            uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  status        automation_log_status not null,
  detail        text,
  created_at    timestamptz default now()
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

-- -------------------------------------------------------------
-- 4. Indexes
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

-- -------------------------------------------------------------
-- 5. RLS Policies — workspace isolation
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

-- Workspaces: members can read, only owners can update/delete
create policy "workspaces_member_read" on public.workspaces for select
  using (id in (select public.current_user_workspace_ids()));
create policy "workspaces_owner_update" on public.workspaces for update
  using (id in (select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role = 'owner'));

-- Memberships: workspace members can read; owners/admins can manage
create policy "memberships_member_read" on public.memberships for select
  using (workspace_id in (select public.current_user_workspace_ids()));

-- All workspace-scoped tables: members can read; members can write
-- (Role-level enforcement happens at the API layer for finer control)
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
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_api_keys_write" on public.api_keys for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "ws_calendar_read" on public.calendar_events for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_calendar_write" on public.calendar_events for all
  using (workspace_id in (select public.current_user_workspace_ids()))
  with check (workspace_id in (select public.current_user_workspace_ids()));

create policy "comments_read" on public.comments for select
  using (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())));
create policy "comments_write" on public.comments for all
  using (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())))
  with check (task_id in (select id from public.tasks where workspace_id in (select public.current_user_workspace_ids())));

-- -------------------------------------------------------------
-- 6. Triggers — updated_at auto-maintenance + auto-deal creation
-- -------------------------------------------------------------

-- Generic updated_at trigger function
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
    select unnest(array['users','workspaces','companies','contacts','leads','pipelines','deals','tasks','notes','calendar_events','automations'])
  loop
    execute format('drop trigger if exists trg_%s_touch on public.%s', tbl, tbl);
    execute format('create trigger trg_%s_touch before update on public.%s for each row execute function public.touch_updated_at();', tbl, tbl);
  end loop;
end $$;

-- AUTO-DEAL CREATION: when a lead's estimated_value is set/changed AND the lead has no converted_deal_id,
-- automatically create a Deal and link it back. When estimated_value or status changes on a lead WITH a deal,
-- sync the deal's amount / expected_close / stage.
create or replace function public.auto_create_or_sync_deal()
returns trigger
language plpgsql
security definer
as $$
declare
  v_pipeline uuid;
  v_stage uuid;
  v_won_stage uuid;
  v_lost_stage uuid;
  v_status_target text;
begin
  -- Only act when estimated_value, expected_close, or status changed
  if (new.estimated_value is null) then return new; end if;
  if (tg_op = 'UPDATE' and old.estimated_value = new.estimated_value
      and old.expected_close = new.expected_close
      and old.status = new.status
      and old.converted_deal_id is not null) then
    return new;
  end if;

  -- Find default pipeline + first stage
  select id into v_pipeline from public.pipelines where workspace_id = new.workspace_id and is_default = true limit 1;
  if v_pipeline is null then
    select id into v_pipeline from public.pipelines where workspace_id = new.workspace_id limit 1;
  end if;
  if v_pipeline is null then return new; end if;

  select id into v_stage from public.stages where pipeline_id = v_pipeline order by "order" asc limit 1;
  if v_stage is null then return new; end if;

  -- Map lead status → stage name
  v_status_target := case new.status
    when 'proposal_sent' then 'Proposal'
    when 'negotiation' then 'Negotiation'
    when 'won' then 'Closed Won'
    when 'lost' then 'Closed Lost'
    when 'qualified' then 'Qualified'
    when 'contacted' then 'Demo'
    else null
  end;
  if v_status_target is not null then
    select id into v_stage from public.stages where pipeline_id = v_pipeline and name ilike '%' || v_status_target || '%' limit 1;
  end if;
  select id into v_won_stage from public.stages where pipeline_id = v_pipeline and is_won = true limit 1;
  select id into v_lost_stage from public.stages where pipeline_id = v_pipeline and is_lost = true limit 1;

  if new.converted_deal_id is null then
    -- Create new deal
    insert into public.deals (workspace_id, pipeline_id, stage_id, contact_id, company_id, owner_id, title, amount, currency, probability, expected_close, closed_at, close_reason)
    values (new.workspace_id, v_pipeline, v_stage, new.contact_id, new.company_id, new.owner_id,
            new.full_name || ' — Deal', coalesce(new.estimated_value, 0), 'INR',
            (select probability from public.stages where id = v_stage),
            new.expected_close,
            case when new.status in ('won','lost') then now() else null end,
            case new.status when 'won' then 'won'::deal_close_reason when 'lost' then 'lost'::deal_close_reason else null end)
    returning id into new.converted_deal_id;
  else
    -- Sync existing deal
    update public.deals set
      amount = coalesce(new.estimated_value, deals.amount),
      expected_close = new.expected_close,
      stage_id = case
        when new.status = 'won' and v_won_stage is not null then v_won_stage
        when new.status = 'lost' and v_lost_stage is not null then v_lost_stage
        when v_status_target is not null and v_stage is not null then v_stage
        else deals.stage_id
      end,
      closed_at = case when new.status in ('won','lost') then now() else deals.closed_at end,
      close_reason = case new.status when 'won' then 'won'::deal_close_reason when 'lost' then 'lost'::deal_close_reason else deals.close_reason end
    where id = new.converted_deal_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_auto_deal on public.leads;
create trigger trg_leads_auto_deal
  after insert or update of estimated_value, expected_close, status
  on public.leads
  for each row execute function public.auto_create_or_sync_deal();

-- -------------------------------------------------------------
-- 7. Views — dashboard aggregates
-- -------------------------------------------------------------

create or replace view public.v_dashboard_metrics as
select
  w.id as workspace_id,
  count(distinct l.id) filter (where l.status not in ('won','lost','archived')) as open_leads,
  count(distinct l.id) filter (where l.status = 'won') as won_leads,
  count(distinct l.id) filter (where l.status = 'lost') as lost_leads,
  coalesce(sum(l.estimated_value) filter (where l.status not in ('won','lost','archived')), 0) as pipeline_value,
  coalesce(sum(l.estimated_value) filter (where l.status = 'won'), 0) as won_value,
  count(distinct d.id) filter (where d.closed_at is null) as open_deals,
  count(distinct d.id) filter (where d.close_reason = 'won') as won_deals,
  count(distinct t.id) filter (where t.status = 'todo') as todo_tasks,
  count(distinct t.id) filter (where t.status = 'in_progress') as in_progress_tasks,
  count(distinct n.id) as total_notes
from public.workspaces w
left join public.leads l on l.workspace_id = w.id
left join public.deals d on d.workspace_id = w.id
left join public.tasks t on t.workspace_id = w.id
left join public.notes n on n.workspace_id = w.id
group by w.id;

create or replace view public.v_pipeline_health as
select
  p.workspace_id,
  p.id as pipeline_id,
  p.name as pipeline_name,
  s.id as stage_id,
  s.name as stage_name,
  s.color as stage_color,
  s.probability,
  s.is_won,
  s.is_lost,
  count(d.id) as deal_count,
  coalesce(sum(d.amount), 0) as stage_value
from public.pipelines p
join public.stages s on s.pipeline_id = p.id
left join public.deals d on d.stage_id = s.id
group by p.id, s.id
order by p.id, s."order";

create or replace view public.v_lead_sources as
select
  workspace_id,
  coalesce(source::text, 'unknown') as source,
  count(*) as count
from public.leads
group by workspace_id, source
order by count desc;

-- -------------------------------------------------------------
-- 8. Functions — lead score (simple heuristic, replaceable with AI)
-- -------------------------------------------------------------

create or replace function public.compute_lead_score(lead_uuid uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_lead public.leads%rowtype;
  v_score integer := 0;
begin
  select * into v_lead from public.leads where id = lead_uuid;
  if not found then return 0; end if;

  -- Email present: +15
  if v_lead.email is not null then v_score := v_score + 15; end if;
  -- Phone present: +10
  if v_lead.phone is not null then v_score := v_score + 10; end if;
  -- Estimated value > 5,00,000: +25
  if v_lead.estimated_value is not null and v_lead.estimated_value > 500000 then
    v_score := v_score + 25;
  elsif v_lead.estimated_value is not null and v_lead.estimated_value > 100000 then
    v_score := v_score + 15;
  end if;
  -- Status progression
  v_score := v_score + case v_lead.status
    when 'qualified' then 20
    when 'proposal_sent' then 30
    when 'negotiation' then 40
    when 'won' then 50
    else 5
  end;
  -- Source weighting
  v_score := v_score + case v_lead.source
    when 'referral' then 15
    when 'event' then 10
    when 'website' then 8
    else 3
  end;
  -- Recent activity (last 7 days): +10
  if v_lead.last_activity_at is not null and v_lead.last_activity_at > now() - interval '7 days' then
    v_score := v_score + 10;
  end if;

  v_score := least(v_score, 100);
  update public.leads set score = v_score where id = lead_uuid;
  return v_score;
end;
$$;

-- -------------------------------------------------------------
-- 9. Realtime publication
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
-- 9b. Workspace Preferences (Phase 3 — Navigation mode persistence)
-- -------------------------------------------------------------
create table if not exists public.workspace_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  nav_mode     text default 'sidebar' check (nav_mode in ('sidebar', 'dock')),
  updated_at   timestamptz default now()
);

alter table public.workspace_preferences enable row level security;
create policy "ws_prefs_read" on public.workspace_preferences for select
  using (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_prefs_write" on public.workspace_preferences for update
  using (workspace_id in (select workspace_id from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid() and m.role in ('owner', 'admin')))
  with check (workspace_id in (select public.current_user_workspace_ids()));
create policy "ws_prefs_insert" on public.workspace_preferences for insert
  with check (workspace_id in (select public.current_user_workspace_ids()));

create index if not exists idx_ws_prefs_workspace on public.workspace_preferences(workspace_id);

-- Auto-upsert helper: create or update nav_mode for a workspace
create or replace function public.upsert_nav_mode(ws_uuid uuid, mode text)
returns void
language sql
security definer
as $$
  insert into public.workspace_preferences (workspace_id, nav_mode)
  values (ws_uuid, mode)
  on conflict (workspace_id) do update set nav_mode = excluded.nav_mode, updated_at = now();
$$;

-- -------------------------------------------------------------
-- 10. Storage buckets
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('venom-files', 'venom-files', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('venom-avatars', 'venom-avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('venom-workspace-logos', 'venom-workspace-logos', true)
  on conflict (id) do nothing;

-- Storage policies: workspace members can read/write files in their workspace path
create policy "venom_files_read" on storage.objects for select
  using (bucket_id = 'venom-files');
create policy "venom_files_write" on storage.objects for insert
  with check (bucket_id = 'venom-files');
create policy "venom_files_delete" on storage.objects for delete
  using (bucket_id = 'venom-files');

create policy "venom_avatars_read" on storage.objects for select
  using (bucket_id = 'venom-avatars');
create policy "venom_avatars_write" on storage.objects for insert
  with check (bucket_id = 'venom-avatars');

-- -------------------------------------------------------------
-- Done. Schema is ready for production use.
-- -------------------------------------------------------------
