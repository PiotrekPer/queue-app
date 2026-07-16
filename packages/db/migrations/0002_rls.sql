-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_rls.sql — Row-Level Security (CLAUDE.md §4.2, non-negotiable)
--
-- Threat model:
--   • Staff = authenticated auth.users with a membership row. They get full CRUD
--     on rows belonging to THEIR venue only. owner|manager may also mutate the
--     venue, its templates, and invite staff (insert memberships).
--   • Guests = anon. They have NO direct table access. The guest ticket page
--     reads via the `get-ticket` edge function and mutates via `guest-action`,
--     both running with service_role AFTER a public_token lookup + rate limit.
--     service_role bypasses RLS, so nothing here needs a guest/anon policy.
--   • visit_events / notifications are insert-only from server contexts (RPCs
--     run SECURITY DEFINER; edge functions use service_role). Staff may SELECT
--     their own venue's rows for the app + analytics.
--
-- Helper predicates below keep policies short and consistent. They are
-- SECURITY INVOKER + STABLE so RLS on `memberships` is evaluated as the caller.
-- ─────────────────────────────────────────────────────────────────────────────

-- Is auth.uid() a member of this venue at all? (any role)
create or replace function app_is_member(p_venue uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.venue_id = p_venue
      and m.user_id  = auth.uid()
  );
$$;

-- Is auth.uid() an owner|manager of this venue? (privileged mutations)
create or replace function app_is_privileged(p_venue uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.venue_id = p_venue
      and m.user_id  = auth.uid()
      and m.role in ('owner', 'manager')
  );
$$;

-- ─── enable RLS on every table (deny-by-default until a policy allows) ───────
alter table venues             enable row level security;
alter table memberships        enable row level security;
alter table guests             enable row level security;
alter table visits             enable row level security;
alter table visit_events       enable row level security;
alter table notifications      enable row level security;
alter table notification_jobs  enable row level security;
alter table message_templates  enable row level security;

-- ─── venues ─────────────────────────────────────────────────────────────────
-- Any member may read their venue; only owner|manager may update it (§4.2).
-- No client-side INSERT/DELETE of venues in v1 (signup handled server-side).
create policy venues_select_member
  on venues for select to authenticated
  using (app_is_member(id));

create policy venues_update_privileged
  on venues for update to authenticated
  using (app_is_privileged(id))
  with check (app_is_privileged(id));

-- ─── memberships ────────────────────────────────────────────────────────────
-- A user may read the membership rows of any venue they belong to (staff roster).
create policy memberships_select_member
  on memberships for select to authenticated
  using (app_is_member(venue_id));

-- Invite: only owner|manager may add staff to their venue (§4.2).
create policy memberships_insert_privileged
  on memberships for insert to authenticated
  with check (app_is_privileged(venue_id));

-- Manage roster: owner|manager may update/remove membership rows in their venue.
create policy memberships_update_privileged
  on memberships for update to authenticated
  using (app_is_privileged(venue_id))
  with check (app_is_privileged(venue_id));

create policy memberships_delete_privileged
  on memberships for delete to authenticated
  using (app_is_privileged(venue_id));

-- ─── guests — staff full CRUD within their venue; anon has NO access ─────────
create policy guests_select_member
  on guests for select to authenticated
  using (app_is_member(venue_id));

create policy guests_insert_member
  on guests for insert to authenticated
  with check (app_is_member(venue_id));

create policy guests_update_member
  on guests for update to authenticated
  using (app_is_member(venue_id))
  with check (app_is_member(venue_id));

create policy guests_delete_member
  on guests for delete to authenticated
  using (app_is_member(venue_id));

-- ─── visits — staff full CRUD within their venue; anon has NO access ─────────
create policy visits_select_member
  on visits for select to authenticated
  using (app_is_member(venue_id));

create policy visits_insert_member
  on visits for insert to authenticated
  with check (app_is_member(venue_id));

create policy visits_update_member
  on visits for update to authenticated
  using (app_is_member(venue_id))
  with check (app_is_member(venue_id));

create policy visits_delete_member
  on visits for delete to authenticated
  using (app_is_member(venue_id));

-- ─── visit_events — insert-only from server contexts; staff SELECT own venue ─
-- RPCs (SECURITY DEFINER) and edge functions (service_role) write these; a
-- direct authenticated INSERT is still allowed for its own venue so the app can
-- append undo/meta rows, but there is deliberately no UPDATE/DELETE (append-only).
create policy visit_events_select_member
  on visit_events for select to authenticated
  using (app_is_member(venue_id));

create policy visit_events_insert_member
  on visit_events for insert to authenticated
  with check (app_is_member(venue_id));

-- ─── notifications — insert-only from server contexts; staff SELECT own venue ─
-- Cost/status rows are written by the notifier (service_role). Staff read them
-- to show the „SMS nie doszedł" badge (§7.4). No client UPDATE/DELETE.
create policy notifications_select_member
  on notifications for select to authenticated
  using (app_is_member(venue_id));

-- ─── notification_jobs — server-only queue ──────────────────────────────────
-- Enqueued by RPCs (SECURITY DEFINER) and drained by the sweep (service_role /
-- cron). No column links a job to a venue directly, so there is no safe
-- authenticated policy: RLS stays on with zero policies → clients see nothing,
-- server roles bypass. (service_role and the definer's owner bypass RLS.)
-- (intentionally no policies)

-- ─── message_templates — members read; owner|manager write (§4.2) ───────────
create policy message_templates_select_member
  on message_templates for select to authenticated
  using (app_is_member(venue_id));

create policy message_templates_insert_privileged
  on message_templates for insert to authenticated
  with check (app_is_privileged(venue_id));

create policy message_templates_update_privileged
  on message_templates for update to authenticated
  using (app_is_privileged(venue_id))
  with check (app_is_privileged(venue_id));

create policy message_templates_delete_privileged
  on message_templates for delete to authenticated
  using (app_is_privileged(venue_id));
