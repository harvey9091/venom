-- =============================================================
-- Fix: break infinite RLS recursion in public.memberships
-- =============================================================
-- Symptom:
--   SELECT on public.memberships returns:
--   42P17: infinite recursion detected in policy for relation "memberships"
--
-- Root cause:
--   memberships_member_read called public.current_user_workspace_ids(),
--   which queried public.memberships, causing a policy evaluation cycle.
--
-- Fix:
--   1. Replace the recursive policy with a direct users lookup.
--   2. Harden current_user_workspace_ids() to SECURITY INVOKER + DISTINCT.
-- =============================================================

-- 1. Replace the recursive read policy on memberships
drop policy if exists "memberships_member_read" on public.memberships;

create policy "memberships_member_read" on public.memberships for select
  using (user_id in (select id from public.users where auth_id = auth.uid()));

-- 2. Harden the helper function so it respects caller RLS and never
--    returns duplicate workspace_ids.
create or replace function public.current_user_workspace_ids()
returns setof uuid
language sql
security invoker
as $$
  select distinct workspace_id
  from public.memberships m
  join public.users u on u.id = m.user_id
  where u.auth_id = auth.uid();
$$;
