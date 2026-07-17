# Spec: Free "table ready" push (Web Push + Wallet passes)

Status: **scaffolded — blocked on credentials** (see §9 for what's built and §6
for what must be provisioned). Decisions in §7 are settled.
Owner: TBD · Relates to CLAUDE.md §7 (notification choreography), §4 (data model),
§1 (guest contract), §13 (milestones).

## 1. Goal & why

Today the only way to pull a guest back is **SMS**, which is the *paid* channel
(§7.1 gating: `plan in (pro, suite)` + prepaid wallet). Every "table ready" on a
free-tier venue silently degrades to page-only — the guest must keep the tab open
and notice the poll flip. That's the weakest link in the guest contract.

**Add a free push channel** so the "STOLIK GOTOWY" moment reaches the guest's lock
screen without an SMS segment cost — for *free-tier venues too*. This makes the
core promise ("SMS ściąga ich z powrotem") true by default, and turns paid SMS
into the *guaranteed-delivery upgrade* rather than the only notification at all.

Must not break the guest contract (§1): **one scan, zero installs, no login, no
typing.** That constraint is what makes this hard — see §3.

## 2. Where it slots into the existing pipeline

The delivery pipeline (`services/notifier/_shared/jobs.ts`) is already channel-
generic: a `notification_jobs` row has a `channel`, `processLockedJob` renders the
template, gates, sends, writes a `notifications` row, and finalises. Adding push is
**a third channel**, not a new pipeline:

- `packages/core/constants.ts` → `CHANNELS = ['sms', 'email', 'push']`.
- Zod (`schemas.ts`) + DB CHECK (`notifications.channel`, migration) widen to allow
  `'push'`.
- `jobs.ts` gating gains a `push` branch: **no plan gate, no wallet debit** (cost
  is 0), best-effort. A `notifications` row is still written (segments=null,
  cost_grosz=0) so the staff card and analytics see it.
- A new sender module (`_shared/webpush.ts` / `_shared/google-wallet.ts`) parallels
  `smsapi.ts` / `resend.ts`.

Crucially, on a "notify" action we can **enqueue push AND sms jobs**: push fires
instantly and free; sms fires only if the venue is paid and the guest gave a phone.
They're independent jobs, already idempotent by job id.

## 3. Channel landscape — the honest constraints

| Mechanism | Zero-install? | iOS | Android | Cost | Notes |
|---|---|---|---|---|---|
| **Web Push** (Push API + service worker, VAPID) | ⚠️ **No on iOS** | Only for a **Home-Screen-installed PWA** (iOS 16.4+). A casual Safari tab **cannot** receive push. | ✅ Chrome/Firefox tab works | Free | Great on Android, blocked for the walk-in iOS Safari guest — that's most of our guests. |
| **Apple Wallet pass** (`.pkpass` + APNs update) | ✅ a pass is not an app | ✅ native, lock-screen update on pass change | n/a | Free to send | Needs Apple Developer acct + Pass Type ID cert + a pass-update web service. |
| **Google Wallet pass** (Generic pass, JWT + API) | ✅ | n/a | ✅ native | Free to send | Needs Google Wallet API issuer account. |

**Takeaway:** Web Push alone does **not** satisfy the contract for iOS guests
(Add-to-Home-Screen reads as an install → violates §1). **Wallet passes are the
only zero-install lock-screen path on iOS.** So the robust answer is Wallet passes,
with Web Push as a free bonus for Android tab users.

## 4. Recommended phasing

- **Phase A — Web Push (Android + installed PWA).** Lowest infra: just VAPID keys,
  a service worker on the guest page, and a `web-push` send in the notifier. Ships
  the channel end-to-end and proves the pipeline wiring. Honest UX: only *offer*
  the "notify me" push prompt when `serviceWorker` + `PushManager` exist AND we're
  not in a plain iOS Safari tab; otherwise fall back to the phone field.
- **Phase B — Apple Wallet + Google Wallet passes.** The real iOS win. "Dodaj do
  Apple Wallet / Google Wallet" button on the waiting screen; pass carries the
  ticket number and updates to "STOLIK GOTOWY" via APNs / Wallet API. Requires the
  external accounts in §6.

Phase A is buildable now on demo data. Phase B is gated on the user provisioning
developer accounts + certs.

## 5. Data model sketch (new)

One table, keyed by visit (the guest already has `visits.public_token` as their
identity — no login):

```sql
-- migration 0008_push.sql (append-only)
create table guest_push_targets (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references visits(id) on delete cascade,
  kind          text not null check (kind in ('webpush', 'apple_wallet', 'google_wallet')),
  -- webpush: endpoint + p256dh + auth. wallet: pass serial + device push token.
  endpoint      text,
  keys          jsonb,
  wallet_serial text,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);
create index on guest_push_targets (visit_id) where revoked_at is null;
```

RLS: anon guests write their own target via the `/a/[token]` action route (proxied
through the edge function, same pattern as contact submission) — never direct table
access (§4.2). Auto-purged with the visit / by the RODO sweep (§11).

## 6. External infra the venue/owner must provision

- **Web Push:** generate a VAPID keypair → `VITE_/EXPO_PUBLIC_VAPID_PUBLIC_KEY` +
  `VAPID_PRIVATE_KEY` (server secret). No account needed. Cheap.
- **Apple Wallet:** Apple Developer Program ($99/yr), a **Pass Type ID** + signing
  cert, and the APNs auth key. Passes signed server-side in an edge function.
- **Google Wallet:** Google Wallet API **issuer account** + a service-account key;
  passes are signed JWTs.

These are secrets → `.env` + Supabase function secrets, never in an app/web bundle
(same rule as `SUPABASE_SERVICE_ROLE_KEY` in DEPLOYMENT.md).

## 7. Decisions (settled)

1. **Free-push vs paid-SMS tension** → **push is free on ALL tiers.** SMS remains
   the paid upgrade, sold as *guaranteed reach* + the heads-up message + analytics;
   push is explicitly **best-effort** (the guest may delete the pass, revoke
   permission, or never opt in). Encoded in `jobs.ts`: the push branch has no plan
   gate and never debits `sms_balance_grosz`.
2. **Platform order** → **both Apple + Google scaffolded together**, sharing one
   design (`packages/core/src/wallet-pass.ts`) so the two cannot drift.
3. **Prompt UX** → **capability-detect and render exactly one CTA** (§9 one bold
   moment): iOS → Apple Wallet, Android → Google Wallet, desktop → nothing. The
   server decides *whether* to offer it at all via `TicketView.can_add_wallet`,
   so we never advertise a button that would 501.

## 8. Why not Web Push as the primary channel

Kept as a free bonus for Android/desktop tabs (`_shared/webpush.ts`), never as the
main path: on iOS the Push API requires a **Home-Screen-installed PWA**, and asking
a walk-in guest to "install" breaks the §1 contract outright. A wallet pass is not
an app — one tap, no install — which is why it, not web push, is the iOS answer.

## 9. Running it (dev tooling)

Google Wallet works end-to-end **today, without Supabase or hosting** — a save URL
is a self-contained signed JWT, and the update is a direct Wallet API call:

```bash
pnpm wallet:save-url                   # mint a save URL → open in Chrome as a TEST account
pnpm wallet:list                       # list saved objects + their ids
pnpm wallet:update <serial> notified   # flip a saved pass → STOLIK GOTOWY on the device
pnpm wallet:update <serial> waiting    # …and back
```

Needs in `.env` (see `.env.example`): `GOOGLE_WALLET_ISSUER_ID`,
`GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_PRIVATE_KEY`. **Credentials are NOT in
the repo** — get them from another dev / the Wallet console and paste them in.
The guest page's button additionally needs them in `apps/web/.env.local` (Next
only reads env from its own app dir).

Gotchas we already hit:
- The issuer is in **demo mode** → only Google accounts on the console's test list
  can save a pass, and passes show a `[TYLKO DO TESTÓW]` prefix.
- The **service account must be authorized on the issuer** (Wallet console →
  Users), or everything 403s.
- `wallet:save-url` mints a **fresh serial each run** — use `wallet:list` to find
  the id of a pass you actually saved.

## 10. Implementation status

**Built and verified (typecheck + lint + 142 tests green):**
- `packages/core` — `push` added to `CHANNELS`, `settings.channels.push` (default
  on), `TicketView.can_add_wallet`, `PushSubscription`/`PushSubscribe` schemas.
- `packages/db/migrations/0008_push.sql` — widened `notifications.channel`,
  `guest_push_targets` (server-only RLS), and a trigger enqueuing a free `push`
  sibling job beside every `sms` job (avoids reissuing the `set_visit_status`
  SECURITY DEFINER RPC).
- `apps/web` — `AddToWallet.tsx`, platform-detected; **screenshot-verified**:
  iPhone UA → Apple button, Android UA → Google button, desktop → nothing.

**Written but NOT machine-verified** (the notifier is Deno and deliberately outside
the pnpm/Turbo build; Deno isn't installed locally, so these are only validated on
deploy per `docs/DEPLOYMENT.md`):
- `_shared/wallet.ts` (the shared pass design), `apple-wallet.ts`, `google-wallet.ts`,
  `push.ts` (fan-out), the `push` branch in `jobs.ts`, `issue-pass/`, `pass-webservice/`.

**Deliberately stubbed — these are the credential-blocked parts:**
| Stub | Needs |
|---|---|
| `buildSignedPkpass()` | Pass Type ID cert → PKCS#7 detached signature over `manifest.json` (Deno has no bundled CMS signer; needs a CMS lib or openssl WASM) |
| `sendApplePassUpdate()` | APNs auth key → ES256 JWT bearer; POST empty push to `api.push.apple.com` |
| `buildSaveJwt()` | Service-account key → RS256 `savetowallet` JWT |
| `sendGooglePassUpdate()` | OAuth2 token (SA JWT-bearer grant) → `PATCH /genericObject/{id}` |

Until credentials land, every entry point degrades to `not_configured`/`501`,
`can_add_wallet` is false, and the guest page simply doesn't show the button —
the live page keeps working (§1: never block).

## 11. Definition of done (per CLAUDE.md §12)

- [x] `pnpm typecheck && lint && test` green.
- [ ] Push gating unit-tested in `packages/core` (cost 0, no debit, no plan gate)
      — the branch currently lives in the Deno notifier, which has no test runner;
      consider lifting the gate decision into core so it *is* testable.
- [ ] New migration applied + RLS reviewed + `pnpm db:types` regenerated (needs a
      live Supabase project).
- [ ] CLAUDE.md §7 updated to make `push` a first-class channel (do in the same PR
      as the un-stubbing).
- [x] Guest-page capability detection verified (Playwright-style UA screenshots).
- [x] pl + en strings added together (`apps/web/src/features/guest/copy.ts`).
