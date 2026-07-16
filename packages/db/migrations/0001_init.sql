-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_init.sql — STOLIQ initial schema (CLAUDE.md §4)
--
-- The 8 core tables, verbatim from the data model. Timezone rule: store UTC,
-- render Europe/Warsaw (§4). Every table has:
--   id         uuid pk default gen_random_uuid()
--   created_at timestamptz default now()
--
-- CHECK constraints and DEFAULTs mirror the Zod schemas in
-- packages/core/src/schemas.ts and the constants in constants.ts — keep in sync.
-- Migrations are append-only; never edit a shipped file, add a new numbered one.
-- ─────────────────────────────────────────────────────────────────────────────

-- gen_random_uuid() + gen_random_bytes() live in pgcrypto.
create extension if not exists pgcrypto;

-- ─── venues — multi-tenancy root (§4) ───────────────────────────────────────
create table venues (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text not null,
  slug              text unique not null,
  city              text,
  plan              text not null default 'free'
                      check (plan in ('free', 'pro', 'suite')),
  settings          jsonb not null default '{}',           -- §4.1 shape
  sms_balance_grosz int  not null default 0,               -- prepaid SMS wallet, integer grosz
  locale            text not null default 'pl'
                      check (locale in ('pl', 'en'))
);

-- ─── memberships — staff = auth.users + venue membership (§4) ────────────────
create table memberships (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid not null references auth.users,
  venue_id     uuid not null references venues,
  role         text not null check (role in ('owner', 'manager', 'staff')),
  display_name text,
  unique (user_id, venue_id)
);

-- ─── guests — venue-scoped, minimal, purgeable PII (§4, §11) ─────────────────
-- All contact fields are optional and guest-entered on their own device (§8).
create table guests (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  venue_id             uuid not null references venues,
  first_name           text,                                -- optional!
  phone_e164           text,                                -- optional, guest-entered, +48…
  email                text,                                -- optional
  marketing_consent_at timestamptz,                         -- null = no marketing consent (separate from service msgs)
  purge_after          date not null                        -- created_at + venue retention_days; RODO auto-purge (§7.6)
);

-- ─── visits — THE core table. One row per party per visit (§4) ───────────────
-- `type` distinguishes walk-in vs reservation (reservation = M4; column exists now).
create table visits (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  venue_id        uuid not null references venues,
  guest_id        uuid references guests,
  type            text not null default 'walk_in'
                    check (type in ('walk_in', 'reservation')),
  status          text not null default 'waiting'
                    check (status in ('waiting', 'notified', 'on_way',
                                      'seated', 'no_show', 'guest_cancelled', 'staff_removed')),
  party_size      int  not null check (party_size between 1 and 30),
  display_name    text,                                     -- denormalized "Ania · 4 os."
  public_token    text unique not null,                     -- 16-char base58, unguessable; guest URL key
  ticket_no       int  not null,                            -- per-venue per-day counter, shown as "Nr 47"
  rank            numeric not null,                         -- queue ordering; default extract(epoch from now())
  quote_minutes   int  not null,                            -- staff-confirmed at add time (§6)
  quote_source    text not null default 'auto'
                    check (quote_source in ('auto', 'manual')),
  notified_at     timestamptz,
  heads_up_sent_at timestamptz,
  hold_expires_at timestamptz,                              -- notified_at + settings.hold_minutes
  on_way_at       timestamptz,
  seated_at       timestamptz,
  ended_at        timestamptz,                              -- set on any terminal status
  ended_reason    text
                    check (ended_reason in ('seated', 'no_show', 'guest_cancelled', 'staff_removed')),
  reservation_at  timestamptz,                              -- M4; null for walk_in
  notes           text
);

-- Queue ordering + realtime list (§5.1) and guest-page token lookup (§4.2).
create index on visits (venue_id, status, rank);
create index on visits (public_token);

-- ─── visit_events — append-only audit + analytics + ML training data (§4) ───
create table visit_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visit_id   uuid not null references visits,
  venue_id   uuid not null,
  actor      text not null,                                 -- 'staff:<user_id>' | 'guest' | 'system'
  event      text not null,                                 -- see constants.VISIT_EVENTS (+ 'undo:<event>')
  meta       jsonb not null default '{}'
);

-- ─── notifications — outbound messages with cost accounting (§4, §7) ─────────
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  visit_id     uuid not null references visits,
  venue_id     uuid not null,
  channel      text not null check (channel in ('sms', 'email')),
  template_key text not null,                               -- 'joined' | 'heads_up' | 'table_ready' | 'renotify'
  to_addr      text not null,
  body         text not null,
  segments     int,                                         -- SMS only (§7.5)
  cost_grosz   int,                                         -- SMS only, from SMSAPI response
  status       text not null default 'queued'
                 check (status in ('queued', 'sent', 'delivered', 'failed')),
  provider_id  text,
  sent_at      timestamptz,
  error        text
);

-- ─── notification_jobs — simple queue processed by pg_cron sweep (§7.4, §7.6) ─
create table notification_jobs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  visit_id     uuid not null,
  template_key text not null,
  channel      text not null,
  run_after    timestamptz not null default now(),
  attempts     int not null default 0,
  locked_at    timestamptz,
  done_at      timestamptz
);

-- Index the sweep's hot path: pick due, unlocked, not-done jobs (§7.6 sweep_jobs).
create index on notification_jobs (run_after) where done_at is null;

-- ─── message_templates — per-venue editable SMS bodies (§7.2, §9.3D) ─────────
create table message_templates (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  venue_id   uuid not null references venues,
  key        text not null,                                 -- 'joined' | 'heads_up' | 'table_ready' | 'renotify'
  locale     text not null default 'pl' check (locale in ('pl', 'en')),
  body       text not null,                                 -- with {{placeholders}}
  unique (venue_id, key, locale)
);
