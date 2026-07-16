-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_cron.sql — scheduled jobs (CLAUDE.md §7.6)
--
--   sweep_jobs     15s   drain notification_jobs → send-notification edge fn
--   sweep_holds    60s   fire 'hold_expired' events for overdue notified visits
--   sweep_heads_up 60s   evaluate the heads-up trigger (§5 #3)
--   purge_guests   daily 04:00  RODO hard-delete of PII past purge_after
--   daily_digest   daily 06:00  per-venue summary email
--
-- Pure-SQL jobs (sweep_holds, purge_guests) run as functions below. Jobs that
-- need application logic (sweep_jobs → SMSAPI/Resend; daily_digest → HTML email;
-- sweep_heads_up → wait-time model in packages/core) POST to a Supabase Edge
-- Function via pg_net (net.http_post). Every schedule is guarded so re-running
-- this migration (or `supabase db reset`) is idempotent.
--
-- SETUP (do once per project — NOT hard-coded here):
--   • Enable extensions: `create extension pg_cron;` and `create extension pg_net;`
--     On Supabase these are enabled from the Dashboard → Database → Extensions
--     (pg_cron installs into schema `cron`). Guarded below with IF NOT EXISTS.
--   • The functions' base URL + service_role key must NOT live in SQL source.
--     Store them in Supabase Vault and read at call time:
--         select vault.create_secret('https://<ref>.functions.supabase.co', 'edge_base_url');
--         select vault.create_secret('<service_role_key>', 'edge_service_key');
--     The helper `edge_post()` below reads them from vault.decrypted_secrets.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── edge_post(fn, payload) — POST to an Edge Function via pg_net ────────────
-- Reads the function base URL + service_role key from Supabase Vault so no
-- secret is committed. Fire-and-forget: returns the pg_net request id.
-- If the secrets are absent (e.g. local dev), it no-ops with a notice.
create or replace function edge_post(p_fn text, p_payload jsonb default '{}')
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_base text;
  v_key  text;
  v_req  bigint;
begin
  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'edge_base_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'edge_service_key';

  if v_base is null or v_key is null then
    raise notice 'edge_post: vault secrets edge_base_url/edge_service_key not set — skipping %', p_fn;
    return null;
  end if;

  select net.http_post(
    url     := v_base || '/' || p_fn,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := p_payload
  ) into v_req;

  return v_req;
end;
$$;

-- ─── sweep_holds() — pure SQL (§7.6) ────────────────────────────────────────
-- For every notified visit whose hold_expires_at has passed and that does NOT
-- yet have a 'hold_expired' event since it was (re)notified, insert one. The
-- card then enters the pulsing UI state (§5 #7). Renotify resets notified_at, so
-- comparing against notified_at makes this correctly re-fire after a renotify.
create or replace function sweep_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with due as (
    select v.id, v.venue_id
      from visits v
     where v.status = 'notified'
       and v.hold_expires_at is not null
       and v.hold_expires_at <= now()
       and not exists (
         select 1 from visit_events e
          where e.visit_id = v.id
            and e.event = 'hold_expired'
            and e.created_at >= v.notified_at   -- only since the current hold window
       )
  ), ins as (
    insert into visit_events (visit_id, venue_id, actor, event, meta)
    select id, venue_id, 'system', 'hold_expired',
           jsonb_build_object('pulse', true)
      from due
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

-- ─── purge_guests() — pure SQL RODO purge (§7.6, §11) ───────────────────────
-- Daily 04:00: hard-delete guest PII past purge_after and anonymize the
-- denormalized name on their visits to 'Gość'. Visit + event + notification rows
-- are KEPT (anonymized) for analytics — only PII leaves. Guests are detached
-- from visits first (guest_id → null) so the delete can't be blocked by the FK.
create or replace function purge_guests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- 1. anonymize denormalized name on affected visits (keep the row).
  update visits v
     set display_name = 'Gość'
    from guests g
   where v.guest_id = g.id
     and g.purge_after < (now() at time zone 'Europe/Warsaw')::date;

  -- 2. detach the FK so we can delete the guest rows.
  update visits v
     set guest_id = null
    from guests g
   where v.guest_id = g.id
     and g.purge_after < (now() at time zone 'Europe/Warsaw')::date;

  -- 3. hard-delete the PII.
  with del as (
    delete from guests
     where purge_after < (now() at time zone 'Europe/Warsaw')::date
    returning 1
  )
  select count(*) into v_count from del;

  return v_count;
end;
$$;

-- ─── schedule everything, idempotently ──────────────────────────────────────
-- cron.schedule(name, schedule, command). We unschedule-if-exists first so this
-- migration can be re-applied cleanly. 15s cadence isn't expressible in 5-field
-- cron, so sweep_jobs uses the pg_cron seconds syntax ('15 seconds').
do $$
declare
  v_job text;
begin
  foreach v_job in array array[
    'sweep_jobs', 'sweep_holds', 'sweep_heads_up', 'purge_guests', 'daily_digest'
  ] loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end;
$$;

-- sweep_jobs — every 15s: hand the queue to the notifier edge function, which
-- locks a batch, renders templates, calls SMSAPI/Resend, writes notifications.
select cron.schedule(
  'sweep_jobs',
  '15 seconds',
  $$ select edge_post('send-notification', jsonb_build_object('trigger', 'cron')); $$
);

-- sweep_holds — every 60s: pure SQL, fire hold_expired events.
select cron.schedule(
  'sweep_holds',
  '60 seconds',
  $$ select sweep_holds(); $$
);

-- sweep_heads_up — every 60s: the heads-up decision needs the wait-time model
-- (median seat intervals, position, ETA — §6, packages/core/wait-time.ts), so it
-- runs in the edge function. It is ALSO evaluated inline after each seating (§5 #3).
select cron.schedule(
  'sweep_heads_up',
  '60 seconds',
  $$ select edge_post('sweep-timers', jsonb_build_object('task', 'heads_up')); $$
);

-- purge_guests — daily 04:00 Warsaw. pg_cron schedules in UTC; 04:00 Europe/Warsaw
-- is 02:00 (winter) / 03:00 (summer) UTC. We schedule at 02:00 UTC and the
-- function itself compares against the Warsaw date, so an occasional DST-hour
-- shift only moves the purge by an hour — harmless for a daily cleanup.
select cron.schedule(
  'purge_guests',
  '0 2 * * *',
  $$ select purge_guests(); $$
);

-- daily_digest — daily 06:00 Warsaw (≈04:00/05:00 UTC; 04:00 chosen). Builds and
-- sends the per-venue summary email (§7.6) in the edge function.
select cron.schedule(
  'daily_digest',
  '0 4 * * *',
  $$ select edge_post('sweep-timers', jsonb_build_object('task', 'daily_digest')); $$
);
