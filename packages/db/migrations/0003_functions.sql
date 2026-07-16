-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_functions.sql — helpers + the two staff-facing RPCs (CLAUDE.md §4.3, §5)
--
--   gen_public_token()        16-char base58, unguessable (§4)
--   next_ticket_no(venue)     per-venue per-day counter, race-safe (§4.3)
--   seed_default_templates()  the 4 default PL SMS bodies (§7.2)
--   create_visit(...)         RPC #1 of §5 (assigns ticket_no/rank/token, logs)
--   set_visit_status(...)     RPC for staff transitions #2,4,5,6,7,8,9,10,11
--                             — validates from→intent SERVER-SIDE (§5), raises a
--                             409-style invalid_transition on illegal moves.
--
-- All are SECURITY DEFINER so they may write visit_events / notification_jobs /
-- touch venues.sms_balance regardless of the caller's RLS; each function
-- re-checks venue membership itself (app_is_member / app_is_privileged) so a
-- staff member can never act on another venue.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── gen_public_token() — 16-char base58 (§4) ───────────────────────────────
-- base58 = Bitcoin alphabet (no 0 O I l, unambiguous). 16 chars of base58 ≈ 93.7
-- bits of entropy — unguessable for the guest URL key. Drawn from pgcrypto CSPRNG.
create or replace function gen_public_token()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; -- 58 chars
  out text := '';
  bytes bytea := gen_random_bytes(16);
  i int;
begin
  for i in 0..15 loop
    -- map each random byte into [0,57]; slight modulo bias is irrelevant at this
    -- entropy level and uniqueness is guaranteed by the visits.public_token unique index.
    out := out || substr(alphabet, (get_byte(bytes, i) % 58) + 1, 1);
  end loop;
  return out;
end;
$$;

-- ─── next_ticket_no(venue) — per-venue per-day counter (§4.3) ────────────────
-- "Nr 47" resets each Warsaw day. Wrapped in a transaction-scoped advisory lock
-- keyed on (venue, warsaw-date) so concurrent adds can't collide on max()+1.
create or replace function next_ticket_no(p_venue uuid)
returns int
language plpgsql
volatile
as $$
declare
  v_day text := ((now() at time zone 'Europe/Warsaw')::date)::text;
  v_next int;
begin
  -- lock is auto-released at COMMIT/ROLLBACK; serialize same venue+day only.
  perform pg_advisory_xact_lock(hashtext(p_venue::text || ':' || v_day));

  select coalesce(max(ticket_no), 0) + 1
    into v_next
    from visits
   where venue_id = p_venue
     and (created_at at time zone 'Europe/Warsaw')::date
         = (now() at time zone 'Europe/Warsaw')::date;

  return v_next;
end;
$$;

-- ─── seed_default_templates(venue) — the 4 default PL bodies (§7.2) ──────────
-- Bodies copied verbatim from CLAUDE.md §7.2 / packages/core/src/templates.ts —
-- diacritic-free on purpose so they stay GSM-7 / 1 segment (§7.5).
-- Idempotent via ON CONFLICT on the (venue_id, key, locale) unique index.
create or replace function seed_default_templates(p_venue uuid)
returns void
language sql
volatile
as $$
  insert into message_templates (venue_id, key, locale, body) values
    (p_venue, 'joined', 'pl',
     'Czesc {{name}}! Jestes w kolejce w {{venue}} (nr {{ticket_no}}). Sledz na zywo: {{link}}'),
    (p_venue, 'heads_up', 'pl',
     '{{venue}}: juz prawie! Twoj stolik bedzie gotowy za chwile. Wracaj powoli :) {{link}}'),
    (p_venue, 'table_ready', 'pl',
     '{{venue}}: Twoj stolik jest gotowy! Mamy go dla Ciebie przez {{hold}} min. {{link}}'),
    (p_venue, 'renotify', 'pl',
     '{{venue}}: przypominamy - stolik czeka. Dasz znac? {{link}}')
  on conflict (venue_id, key, locale) do nothing;
$$;

-- ─── create_visit(...) — §5 #1 (the 5-second add) ───────────────────────────
-- Assigns ticket_no (race-safe), rank = epoch(now()), a unique public_token,
-- inserts the visit + a 'created' visit_events row, returns the full row.
-- The quote itself is computed client-side (§6, packages/core/wait-time.ts) and
-- passed in as p_quote_minutes/p_quote_source. guest_id linkage happens later
-- when the guest self-enters a phone on the ticket page (§8) — not here (§1.1:
-- phone is deliberately absent from the add flow).
create or replace function create_visit(
  p_venue        uuid,
  p_party_size   int,
  p_display_name text,
  p_quote_minutes int,
  p_quote_source text default 'auto',
  p_type         text default 'walk_in'
)
returns visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit  visits;
  v_token  text;
  v_tries  int := 0;
begin
  -- caller must be a member of this venue (SECURITY DEFINER bypasses RLS).
  if not app_is_member(p_venue) then
    raise exception 'not a member of venue %', p_venue
      using errcode = '42501'; -- insufficient_privilege
  end if;

  -- retry token generation on the astronomically unlikely unique collision.
  loop
    v_token := gen_public_token();
    v_tries := v_tries + 1;
    exit when not exists (select 1 from visits where public_token = v_token);
    if v_tries >= 5 then
      raise exception 'could not generate a unique public_token';
    end if;
  end loop;

  insert into visits (
    venue_id, type, status, party_size, display_name,
    public_token, ticket_no, rank, quote_minutes, quote_source
  ) values (
    p_venue,
    coalesce(p_type, 'walk_in'),
    'waiting',
    p_party_size,
    p_display_name,
    v_token,
    next_ticket_no(p_venue),
    extract(epoch from now()),                 -- rank default (§4)
    p_quote_minutes,
    coalesce(p_quote_source, 'auto')
  )
  returning * into v_visit;

  insert into visit_events (visit_id, venue_id, actor, event, meta)
  values (
    v_visit.id, p_venue,
    'staff:' || coalesce(auth.uid()::text, 'system'),
    'created',
    jsonb_build_object(
      'party_size',   p_party_size,
      'quote',        p_quote_minutes,
      'quote_source', coalesce(p_quote_source, 'auto')
    )
  );

  return v_visit;
end;
$$;

-- ─── set_visit_status(...) — staff transitions (§5 state machine) ────────────
-- Mirrors packages/core/src/state-machine.ts server-side. p_intent is one of the
-- staff-driven TransitionIntent values. Illegal from→intent raises
-- `invalid_transition` (SQLSTATE 'P0409' → surface as HTTP 409, §5).
--
-- Guest-driven intents (guest_on_way / guest_cancel / guest_delay) are NOT
-- exposed here — they arrive through the `guest-action` edge function
-- (service_role) which performs the same validation.
--
-- Undo (§5): every staff mutation shows a 5s "Cofnij" toast. Undo is a
-- COMPENSATING transition that restores the prior timestamps from the
-- visit_events log and appends event 'undo:<original>'. It is implemented
-- generically in the app/edge layer off visit_events (not a dedicated RPC) so it
-- can reverse any transition; this function is the forward half.
create or replace function set_visit_status(
  p_visit  uuid,
  p_intent text,
  p_meta   jsonb default '{}'
)
returns visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit    visits;
  v_from     text;
  v_venue    uuid;
  v_next     text;
  v_event    text;
  v_reason   text := null;
  v_pulse    boolean := false;
  v_job      text := null;      -- template_key to enqueue, or null
  v_meta     jsonb := coalesce(p_meta, '{}'::jsonb);
  v_renotify int;
  v_next_rank      numeric;
  v_next_next_rank numeric;
  v_actor    text;
  v_hold_min int;
begin
  -- lock the row for the duration of the transition (serialize concurrent taps).
  select * into v_visit from visits where id = p_visit for update;
  if not found then
    raise exception 'visit % not found', p_visit using errcode = 'P0404';
  end if;

  v_from  := v_visit.status;
  v_venue := v_visit.venue_id;

  if not app_is_member(v_venue) then
    raise exception 'not a member of venue %', v_venue using errcode = '42501';
  end if;

  v_actor := 'staff:' || coalesce(auth.uid()::text, 'system');

  -- hold window length from venue settings (default 7 min, §4.1).
  select coalesce((settings->>'hold_minutes')::int, 7) into v_hold_min
    from venues where id = v_venue;

  -- ── validate from→intent and compute effects (mirror of §5 table) ─────────
  case p_intent

    -- #2 waiting → notified
    when 'notify' then
      if v_from <> 'waiting' then
        raise exception 'invalid_transition: cannot notify from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'notified';
      v_event := 'notified';
      v_job   := 'table_ready';
      update visits
         set status = 'notified',
             notified_at = now(),
             hold_expires_at = now() + make_interval(mins => v_hold_min)
       where id = p_visit
      returning * into v_visit;

    -- #5/#6 waiting|notified|on_way → seated
    when 'seat' then
      if v_from not in ('waiting', 'notified', 'on_way') then
        raise exception 'invalid_transition: cannot seat from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'seated';
      v_event := 'seated';
      v_reason := 'seated';
      if v_from = 'waiting' then
        v_meta := v_meta || jsonb_build_object('skipped_notify', true);
      end if;
      update visits
         set status = 'seated',
             seated_at = now(),
             ended_at = now(),
             ended_reason = 'seated'
       where id = p_visit
      returning * into v_visit;

    -- #7 notified → notified (hold elapsed; no state change; pulse). Usually
    -- fired by the sweep, exposed here for manual/test use.
    when 'hold_expired' then
      if v_from <> 'notified' then
        raise exception 'invalid_transition: cannot hold_expired from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'notified';
      v_event := 'hold_expired';
      v_pulse := true;
      -- no column change; row unchanged.

    -- #7 notified → notified (staff re-notifies; max 1; new hold timer)
    when 'renotify' then
      if v_from <> 'notified' then
        raise exception 'invalid_transition: cannot renotify from %', v_from using errcode = 'P0409';
      end if;
      select count(*) into v_renotify
        from visit_events
       where visit_id = p_visit and event = 'renotified';
      if v_renotify >= 1 then
        raise exception 'invalid_transition: renotify limit reached' using errcode = 'P0409';
      end if;
      v_next  := 'notified';
      v_event := 'renotified';
      v_job   := 'renotify';
      update visits
         set notified_at = now(),
             hold_expires_at = now() + make_interval(mins => v_hold_min)
       where id = p_visit
      returning * into v_visit;

    -- #8 waiting|notified → waiting (Pomiń). Drops exactly one place via
    -- midpoint of the next two active ranks (fractional rank, no renumber).
    when 'skip' then
      if v_from not in ('waiting', 'notified') then
        raise exception 'invalid_transition: cannot skip from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'waiting';
      v_event := 'skipped';

      -- next two active parties strictly behind this one, by rank.
      select rank into v_next_rank
        from visits
       where venue_id = v_venue
         and status in ('waiting', 'notified', 'on_way')
         and rank > v_visit.rank
       order by rank asc
       limit 1;

      select rank into v_next_next_rank
        from visits
       where venue_id = v_venue
         and status in ('waiting', 'notified', 'on_way')
         and rank > coalesce(v_next_rank, v_visit.rank)
       order by rank asc
       limit 1;

      -- RANK_STEP mirrors packages/core/src/rank.ts skipRank() (= 1000).
      update visits
         set status = 'waiting',
             notified_at = null,        -- clear (§5 #8)
             hold_expires_at = null,
             rank = case
                      -- no one behind → nudge past current tail so it truly drops one
                      when v_next_rank is null then v_visit.rank + 1000
                      -- one behind → land just past them (core: nextRank + RANK_STEP)
                      when v_next_next_rank is null then v_next_rank + 1000
                      -- two+ behind → midpoint of the next two (core: midpoint())
                      else (v_next_rank + v_next_next_rank) / 2.0
                    end
       where id = p_visit
      returning * into v_visit;

    -- #9 notified → no_show (Nie przyszli)
    when 'no_show' then
      if v_from <> 'notified' then
        raise exception 'invalid_transition: cannot no_show from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'no_show';
      v_event := 'no_show';
      v_reason := 'no_show';
      update visits
         set status = 'no_show', ended_at = now(), ended_reason = 'no_show'
       where id = p_visit
      returning * into v_visit;

    -- #10 waiting|notified|on_way → guest_cancelled. Normally guest-driven, but
    -- staff may cancel on the guest's behalf; keep parity with the machine.
    when 'guest_cancel' then
      if v_from not in ('waiting', 'notified', 'on_way') then
        raise exception 'invalid_transition: cannot guest_cancel from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'guest_cancelled';
      v_event := 'guest_cancelled';
      v_reason := 'guest_cancelled';
      update visits
         set status = 'guest_cancelled', ended_at = now(), ended_reason = 'guest_cancelled'
       where id = p_visit
      returning * into v_visit;

    -- #4 notified → on_way. Normally guest-driven (edge fn); parity kept here.
    when 'guest_on_way' then
      if v_from <> 'notified' then
        raise exception 'invalid_transition: cannot guest_on_way from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'on_way';
      v_event := 'on_way';
      update visits
         set status = 'on_way', on_way_at = now()
       where id = p_visit
      returning * into v_visit;

    -- #11 waiting|notified → staff_removed (Usuń)
    when 'staff_remove' then
      if v_from not in ('waiting', 'notified') then
        raise exception 'invalid_transition: cannot staff_remove from %', v_from using errcode = 'P0409';
      end if;
      v_next  := 'staff_removed';
      v_event := 'staff_removed';
      v_reason := 'staff_removed';
      update visits
         set status = 'staff_removed', ended_at = now(), ended_reason = 'staff_removed'
       where id = p_visit
      returning * into v_visit;

    else
      raise exception 'invalid_transition: unknown intent %', p_intent using errcode = 'P0409';
  end case;

  -- ── append the event row (append-only audit, §4) ──────────────────────────
  insert into visit_events (visit_id, venue_id, actor, event, meta)
  values (
    p_visit, v_venue, v_actor, v_event,
    v_meta
      || jsonb_build_object('from', v_from, 'to', v_next)
      || case when v_pulse then jsonb_build_object('pulse', true) else '{}'::jsonb end
  );

  -- ── enqueue a notification job if the transition asks for one (§7.4) ──────
  -- The sweep + send-notification edge function do the final SMS eligibility
  -- gating (phone present + paid plan + channels.sms + balance, §7.1); we only
  -- decide WHICH template. Channel defaults to sms.
  if v_job is not null then
    insert into notification_jobs (visit_id, template_key, channel)
    values (p_visit, v_job, 'sms');
  end if;

  return v_visit;
end;
$$;

-- Allow the app (authenticated) to call the RPCs; the definer body enforces
-- per-venue membership itself. Guests never call these (edge functions do).
grant execute on function create_visit(uuid, int, text, int, text, text) to authenticated;
grant execute on function set_visit_status(uuid, text, jsonb)            to authenticated;
grant execute on function seed_default_templates(uuid)                   to authenticated;
