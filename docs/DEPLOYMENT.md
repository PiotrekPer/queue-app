# Stoliq — Deployment

## Backends

### Local (Docker) — for development / demos
```bash
pnpm install
npx supabase init                 # once (creates supabase/config.toml)
# copy the canonical migrations into the CLI's folder (timestamp-named):
#   packages/db/migrations/000N_*.sql → supabase/migrations/<ts>_*.sql
npx supabase start                # pulls images, applies migrations
# seed against the running instance:
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local service_role> \
  pnpm --filter @stoliq/db seed
npx supabase status               # prints API URL + anon/service keys
npx supabase stop                 # shut down (DB data persists)
```
The `supabase/` directory is generated locally (git-ignored) — the canonical
migrations live in `packages/db/migrations` and functions in `services/notifier`.

### Cloud (production) — Supabase EU / Frankfurt
1. Create a Supabase project in **eu-central-1 (Frankfurt)** (§11 data residency).
2. `supabase link --project-ref <ref>` then `supabase db push` (applies migrations
   incl. `0004_cron` — enable the `pg_cron` + `pg_net` extensions in the dashboard
   first, and set the Vault secrets `edge_base_url` + `edge_service_key`, see
   `0004_cron.sql`).
3. `supabase functions deploy get-ticket guest-action send-notification sweep-timers purge-guests issue-pass pass-webservice`
   (from `services/notifier`). The wallet/push functions (`issue-pass`,
   `pass-webservice`) also need their secrets — `supabase secrets set` the
   `GOOGLE_WALLET_*`, `APPLE_*` (incl. `APPLE_WWDR_CERT`) and `VAPID_*` values
   from `.env.example`.
4. Seed a demo venue if desired (`pnpm --filter @stoliq/db seed` with the project's
   URL + service_role key), or onboard a real venue.
5. `supabase gen types typescript --linked > packages/db/src/generated/types.ts`.

## Web (`apps/web`) → Vercel
- Framework: Next.js. Build: `pnpm --filter @stoliq/web build`.
- Env (Vercel project settings):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GUEST_BASE_URL`
  - `NEXT_PUBLIC_POSTHOG_KEY` (marketing analytics; optional)
  - **Do NOT** set `SUPABASE_SERVICE_ROLE_KEY` in production — its absence makes the
    guest page use the deployed `get-ticket` edge function (guests never get direct
    table access).
- Point `stq.pl/v/{token}` (the QR/SMS link) at this deployment.

## Staff app (`apps/staff`) → EAS
- Expo SDK 54. `eas build` (iOS/Android) + `eas update` (OTA).
- Public env (bundled — no secrets): `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Store review login: the seeded `kelner@stoliq.app` / `stoliq-demo-1`.

## SMS (SMSAPI.pl)
Register the alphanumeric sender **"STOLIQ"** early (takes days). Set
`SMSAPI_TOKEN` + `SMS_SENDER=STOLIQ` in the Edge Functions' secrets. Cost is
tracked per message via the `sms-segments` model (§7.5) — Polish diacritics force
UCS-2 and ~2–3× cost, so default templates ship diacritic-free.

## Secrets checklist
`.env.example` is the canonical list. Never commit real values (`.env*` is
git-ignored except `.env.example`). Edge-function-only: `SUPABASE_SERVICE_ROLE_KEY`,
`SMSAPI_TOKEN`, `RESEND_API_KEY`.

## Verification (CI)
`pnpm typecheck && pnpm lint && pnpm test` at the root. `apps/web` builds; the
staff app bundles via `expo export`. Golden flows: Playwright (`apps/web/e2e`),
Maestro (`apps/staff/.maestro`).
