# services/notifier — Stoliq Edge Functions (Deno)

Supabase Edge Functions (Deno runtime) that own the **guest access surface** and
the **notification pipeline** (CLAUDE.md §7, §8, §4.2). These are **not** part of
the pnpm/Turbo build — they run on Deno and import the shared brain
`@stoliq/core` via an import map (see the boundary caveat below).

## Functions

| Function | Method | Who calls it | Does (spec) |
|---|---|---|---|
| `get-ticket` | `GET ?token=` | guest ticket page (browser) | Load visit by `public_token`, compute live position, return sanitized `TicketView` (§8). No PII beyond `display_name`. |
| `guest-action` | `POST` | guest ticket page (browser) | Two body shapes: **action** `{token, action}` → state-machine transition (§5, §7.3); **set-contact** `{token, phone_e164?, email?, marketing_consent}` → upsert guest + link (§8, §11). Returns fresh `TicketView`. |
| `send-notification` | `POST {job_id}` | sweep / staff pipeline | Lock+process one `notification_jobs` row: render template, gate (§7.1), send SMS/email, write `notifications` (segments+cost), debit wallet, retry×3 (§7.4). |
| `sweep-timers` | `POST` | pg_cron (15–60s) | Three inline sweeps (§7.6): due jobs, `hold_expired` events, heads-up trigger #3. |
| `purge-guests` | `POST` | pg_cron (daily 04:00) | Hard-delete guest PII past `purge_after`, anonymize `visits.display_name` → `Gość`, scrub `notifications.to_addr` (§7.6, §11). |

`get-ticket` and `guest-action` are rate-limited **30 req/min per token, 120 req/min
per IP** (§4.2) via an in-memory sliding window (`_shared/ratelimit.ts`). That is a
best-effort per-instance guard; durable limiting belongs at the gateway.

## Layout

```
services/notifier/
  deno.json                    # import map: @stoliq/core, supabase-js, zod
  functions/
    _shared/
      admin.ts                 # service-role Supabase client + env helpers
      cors.ts                  # CORS headers + json()/preflight()/errorBody()
      ratelimit.ts             # sliding window: perToken 30/min, perIp 120/min
      links.ts                 # GUEST_BASE_URL + /v/{token}
      time.ts                  # null-safe formatWarsawTime wrapper
      smsapi.ts                # SMSAPI.pl REST client (sendSms → segments+cost)
      resend.ts                # Resend email fallback (sendEmail)
      ticket.ts                # loadVisitByToken, computeVisitPosition, buildTicketView
      jobs.ts                  # §7.4 pipeline: lock → render → gate → send → account → retry
      sweeps.ts                # §7.6 sweep bodies (jobs / holds / heads-up)
    get-ticket/index.ts
    guest-action/index.ts
    send-notification/index.ts
    sweep-timers/index.ts
    purge-guests/index.ts
```

Shared logic lives in `_shared/`; functions are thin HTTP handlers over it.

## Deploy

```bash
# From the repo root, with the Supabase CLI linked to the EU (Frankfurt) project.
supabase functions deploy get-ticket
supabase functions deploy guest-action
supabase functions deploy send-notification
supabase functions deploy sweep-timers
supabase functions deploy purge-guests
```

`get-ticket` / `guest-action` are guest-facing and must be reachable without a
Supabase JWT — deploy with `--no-verify-jwt` (auth is the unguessable token, §4.2):

```bash
supabase functions deploy get-ticket --no-verify-jwt
supabase functions deploy guest-action --no-verify-jwt
```

`send-notification`, `sweep-timers`, `purge-guests` are service-only; keep JWT
verification on and invoke them from pg_cron with the service role (see below).

### Schedule the sweeps (pg_cron, §7.6)

```sql
-- every 15s: process the job queue + 60s-cadence holds/heads-up are cheap to
-- re-run, so one sweep endpoint covers all three (idempotent).
select cron.schedule('stoliq-sweep', '15 seconds',
  $$ select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/sweep-timers',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$);

-- daily 04:00 Europe/Warsaw purge
select cron.schedule('stoliq-purge', '0 2 * * *',  -- 02:00 UTC ≈ 04:00 CEST
  $$ select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/purge-guests',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$);
```

## Secrets / env (§12.5)

Set with `supabase secrets set KEY=value` (never bundled into any client):

| Var | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | all | project URL (auto-populated in the Edge runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | all | RLS-bypass; **functions only** (§4.2) |
| `SMSAPI_TOKEN` | send-notification, sweep-timers | SMSAPI.pl OAuth token (Bearer) |
| `SMS_SENDER` | send-notification | alphanumeric sender, default `STOLIQ` |
| `RESEND_API_KEY` | send-notification (email fallback) | optional |
| `GUEST_BASE_URL` | link building | default `https://stq.pl`; `/v/{token}` appended |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Supabase Edge runtime; set the rest explicitly.

## The pnpm ↔ Deno boundary (important)

These functions are **Deno**, but they import the same tested shared logic the
pnpm apps use — `@stoliq/core`. We bridge that with an **import map** in
`deno.json`:

```jsonc
"imports": {
  "@stoliq/core": "../../packages/core/src/index.ts",
  "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
  "zod": "npm:zod@3"
}
```

So `import { describeTransition } from '@stoliq/core'` resolves straight to the
package source — no copy-paste, one source of truth (§3, §12.1). `@stoliq/core`
is pure TypeScript with a single `zod` dependency and **no Node built-ins**, so it
runs unchanged under Deno.

`@stoliq/core` uses **extensionless** internal imports (`./constants`), which the
pnpm bundler resolves but Deno does not by default. We therefore enable
`"unstable": ["sloppy-imports"]` in `deno.json` so `deno check` / the Edge runtime
resolve `./constants` → `./constants.ts`. This is verified green:

```bash
deno check --config services/notifier/deno.json services/notifier/functions/**/index.ts
# Check ... (all five functions, no errors)
```

**Caveat — if the Supabase bundler cannot resolve the relative source import**
(it bundles each function's directory and may not reach up into `packages/`),
vendor the needed modules next to the functions before deploy, e.g.:

```bash
# one-time: copy the core source Deno needs into a vendored dir and repoint the
# import map at it (only if `supabase functions deploy` fails to resolve @stoliq/core)
mkdir -p services/notifier/functions/_vendor/core
cp -r packages/core/src/* services/notifier/functions/_vendor/core/
# then set "@stoliq/core": "./functions/_vendor/core/index.ts" in deno.json
```

Prefer the import-map path; only vendor if a deploy actually fails to resolve it.
Never edit `packages/core` from here — it is the shared, tested API.

## Local dev

```bash
supabase functions serve get-ticket --no-verify-jwt --env-file services/notifier/.env.local
# then: GET http://localhost:54321/functions/v1/get-ticket?token=<public_token>
```

Type-check the whole service against `@stoliq/core`:

```bash
deno check services/notifier/functions/**/index.ts
```
