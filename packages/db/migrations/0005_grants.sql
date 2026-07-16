-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_grants.sql — base table/role GRANTs (CLAUDE.md §4.2)
--
-- RLS policies (0002) decide WHICH rows each role may touch, but a policy is moot
-- without the underlying table GRANT: PostgREST raises "permission denied for
-- table …" before RLS is ever evaluated. Supabase's default privileges grant the
-- non-DML bits (truncate/references/trigger) but NOT select/insert/update/delete,
-- so we grant those explicitly here, matching the access model:
--
--   • service_role  — bypasses RLS; full DML (the seed + every edge function's
--                     adminClient run as service_role after a token lookup).
--   • authenticated — full DML, but every row is gated to the staff member's
--                     venue by the 0002 policies (§4.2 "full CRUD on own venue").
--   • anon          — NO table access; guests reach data only through the
--                     get-ticket / guest-action edge functions (§4.2).
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;

-- service_role: unrestricted (bypasses RLS).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- authenticated: DML on every app table; the 0002 RLS policies restrict rows.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all routines in schema public to authenticated;

-- Keep future tables consistent (defensive; all current tables are covered above).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
