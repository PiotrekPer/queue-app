-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_fix_membership_helpers.sql — make the RLS helpers SECURITY DEFINER
--
-- app_is_member / app_is_privileged are used INSIDE the RLS policies on the
-- `memberships` table itself (memberships_select_member = app_is_member(venue_id)).
-- As SECURITY INVOKER (the default) their `select from memberships` is re-gated by
-- that same policy → infinite recursion, which Postgres resolves to "no rows", so
-- a staff member could not even read their own membership (and every venue-scoped
-- read/RPC that depends on it failed).
--
-- Making them SECURITY DEFINER runs the membership lookup as the function owner
-- (bypassing RLS), breaking the recursion. `auth.uid()` still reflects the caller.
-- This is the standard Supabase pattern for membership-check helpers.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function app_is_member(p_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.venue_id = p_venue
      and m.user_id  = auth.uid()
  );
$$;

create or replace function app_is_privileged(p_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.venue_id = p_venue
      and m.user_id  = auth.uid()
      and m.role in ('owner', 'manager')
  );
$$;
