# @stoliq/db

Postgres / Supabase schema for STOLIQ — the single source of truth for tables,
RLS, RPCs, and scheduled jobs. Everything here implements CLAUDE.md §4, §4.2,
§4.3, §5, §7.6. When the DB and the spec disagree, **the spec wins** — fix the
migration and update CLAUDE.md in the same PR (§12.1).

## Layout

```
packages/db/
  migrations/
    0001_init.sql       8 core tables, CHECK constraints, indexes (§4)
    0002_rls.sql        Row-Level Security on every table (§4.2)
    0003_functions.sql  gen_public_token, next_ticket_no, seed_default_templates,
                        create_visit RPC, set_visit_status RPC (§4.3, §5)
    0004_cron.sql       pg_cron schedules + sweep_holds / purge_guests SQL (§7.6)
  src/                  generated types + JS seed (owned elsewhere)
  README.md             this file
```

Migrations are **append-only and numbered**. Never edit a shipped file — add the
next number. This keeps `supabase db push` deterministic across environments.

## Applying migrations

Local (Supabase CLI, against the local stack):

```bash
supabase start                 # boots local Postgres + Auth + Realtime
supabase migration up          # applies packages/db/migrations/*.sql in order
# or, full reset from scratch (re-runs every migration + seed):
supabase db reset
```

Linked / remote (staging or prod project, EU Frankfurt — §2):

```bash
supabase link --project-ref <ref>
supabase db push               # pushes pending migrations to the linked project
```

Regenerate the TypeScript row types after any schema change (§12.1):

```bash
supabase gen types typescript --linked > packages/db/src/generated/types.ts
# (pnpm --filter @stoliq/db types prints this command)
```

### Extensions

- `0001` enables **pgcrypto** (`gen_random_uuid()`, `gen_random_bytes()`).
- `0004` enables **pg_cron** (schema `cron`) and **pg_net** (`net.http_post`).
  On Supabase, pg_cron/pg_net are toggled in Dashboard → Database → Extensions;
  the `create extension if not exists` guards make re-runs safe.

## The security model (read before touching policies)

Two audiences, enforced entirely at the database boundary:

### Staff = `authenticated` + a membership row

RLS on every table restricts staff to rows in **their own venue(s)**:

```
venue_id in (select venue_id from memberships where user_id = auth.uid())
```

expressed via the `app_is_member(venue)` helper. Privileged mutations —
UPDATE `venues`, all writes to `message_templates`, and INSERT `memberships`
(inviting staff) — additionally require `owner` or `manager`, via
`app_is_privileged(venue)` (§4.2).

- `visit_events` and `notifications` are effectively **append/read-only** for
  staff: SELECT own venue, INSERT own venue (events only), no UPDATE/DELETE. They
  are the analytics + ML-training log and must stay immutable (§4).
- `notification_jobs` has **no client policy at all** — RLS is on with zero
  policies, so `authenticated`/`anon` see nothing. Only the RPCs (SECURITY
  DEFINER) and the sweep (`service_role`/cron) touch it.

### Guests = `anon` — **zero direct table access**

Guests never hit Postgres directly. The ticket page (`/v/{token}`) reads through
the **`get-ticket`** edge function and mutates through **`guest-action`**, both
running with `service_role` **after** looking up the row by `public_token` and
rate-limiting (30 req/min per token, 120 per IP — §4.2). `service_role` bypasses
RLS, which is why there are deliberately **no anon/guest policies** in
`0002_rls.sql`. This is the RODO posture: the guest's own device talks to a
function, not the tables.

## RPCs (call via `supabase.rpc(...)`)

All are `SECURITY DEFINER` and re-check `app_is_member` internally, so a staff
member can never act on another venue even though the definer bypasses RLS.

| Function | Purpose |
|---|---|
| `gen_public_token()` | 16-char base58, CSPRNG (pgcrypto), unguessable guest URL key (§4). |
| `next_ticket_no(venue)` | Per-venue per-day `Nr` counter. `pg_advisory_xact_lock` on `(venue, Warsaw-date)` avoids races (§4.3). |
| `seed_default_templates(venue)` | Seeds the 4 default **diacritic-free** PL SMS bodies (§7.2). Idempotent. |
| `create_visit(venue, party_size, display_name, quote_minutes, quote_source, type)` | §5 #1: assigns `ticket_no` / `rank = epoch(now())` / `public_token`, inserts the visit + a `created` event, returns the row. |
| `set_visit_status(visit, intent, meta)` | Staff transitions #2,4,5,6,7,8,9,10,11. Validates `from → intent` **server-side**; illegal moves raise `invalid_transition` (SQLSTATE `P0409` → treat as **HTTP 409**, §5). `skip` recomputes `rank` via the midpoint of the next two active ranks (drops exactly one place, no renumber cascade — §5 #8). Enqueues the right `notification_jobs` row for `notify`/`renotify`. |

**Undo (§5):** every staff mutation shows a 5-second `Cofnij` toast. Undo is a
*compensating* transition implemented generically off `visit_events` (restore
prior timestamps, append `undo:<original>`) in the app / edge layer — not a
dedicated RPC — so it can reverse any forward transition. `set_visit_status` is
the forward half.

Guest-driven intents (`guest_on_way`, `guest_cancel`, `guest_delay`) also exist
in `set_visit_status` for parity/testing, but in production they arrive through
the `guest-action` edge function (which runs the same validation under
`service_role`).

## Scheduled jobs (`0004_cron.sql`, §7.6)

| Job | Cadence | Kind | Does |
|---|---|---|---|
| `sweep_jobs` | 15s | edge (`send-notification`) | drains `notification_jobs`, sends SMS/email, writes `notifications` with segments+cost. |
| `sweep_holds` | 60s | pure SQL | inserts `hold_expired` events for notified visits past `hold_expires_at` (once per hold window). |
| `sweep_heads_up` | 60s | edge (`sweep-timers`) | evaluates the heads-up trigger (§5 #3) using the wait-time model. Also runs inline after each seating. |
| `purge_guests` | daily 04:00 Warsaw | pure SQL | hard-deletes guest PII past `purge_after`, anonymizes `visits.display_name → 'Gość'`, keeps event/notification rows (§11). |
| `daily_digest` | daily 06:00 Warsaw | edge (`sweep-timers`) | per-venue summary email. |

Every `cron.schedule` is guarded by an unschedule-if-exists loop, so the
migration is **idempotent** under `supabase db reset` / re-push.

### Configuring the edge calls (no secrets in SQL)

Edge-backed jobs POST via `edge_post(fn, payload)`, which reads the function base
URL and `service_role` key from **Supabase Vault** — nothing is committed:

```sql
select vault.create_secret('https://<project-ref>.functions.supabase.co', 'edge_base_url');
select vault.create_secret('<service_role_key>',                          'edge_service_key');
```

If those secrets are absent (e.g. local dev without functions deployed),
`edge_post` no-ops with a notice, so the pure-SQL sweeps still run cleanly.

> pg_cron schedules in **UTC**; the daily jobs are pinned to the UTC hour closest
> to their Warsaw target and the SQL bodies compare against the Warsaw date, so a
> DST boundary only shifts a daily cleanup by an hour — harmless.
