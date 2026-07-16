# Stoliq — Architecture (logic & design)

> The product/design spec lives in [`CLAUDE.md`](../CLAUDE.md). This file documents
> **how the code is put together** and the decisions taken while building it.

## Monorepo shape

```
packages/core      the shared brain — imported everywhere, never copied
packages/ui-tokens tokens.json → Tailwind (@theme CSS) + NativeWind preset + RN theme
packages/db        SQL migrations, RLS, RPCs, generated types, seed
services/notifier  Supabase Edge Functions (Deno) — production guest read/write + sweeps
apps/web           Next.js — marketing landing + guest ticket ("numerek")
apps/staff         Expo (SDK 54) — the staff app
```

`@stoliq/core` is the single source of truth for business logic: Zod schemas
(every boundary shape), the **visit state machine** (`describeTransition` — pure,
returns the exhaustive side-effects for each §5 transition), the **wait-time**
model (§6, DST-safe), **SMS segment** analysis (§7.5 GSM-7/UCS-2), **rank** math
(§5.1 fractional-rank skip), templates, and pl/en i18n. It has full Vitest
coverage (126 tests) and is imported by the app, the web, the edge functions, and
the DB seed — so the same rules run on every surface.

## Data flow

### Staff app (the product)
```
Add flow ─ addVisit() ─▶ create_visit RPC (SECURITY DEFINER, assigns
                          ticket_no/rank/token, logs 'created') ─▶ visits
TicketCard ─ applyIntent(intent) ─▶ set_visit_status RPC (validates from→intent
                          server-side, raises P0409 on illegal moves) ─▶ visits
Kolejka ◀─ Supabase Realtime (visits channel) + optimistic local store (Zustand)
```
The queue store (`apps/staff/src/features/queue/store.ts`) is **optimistic-first**:
every mutation applies locally + fires a haptic + records an undo entry, then
persists via the RPC in the background and reconciles the authoritative row
(Realtime also echoes it). Without a backend (`hasBackend === false`) it seeds a
deterministic demo queue so the whole UI is alive for demos.

### Guest (the "numerek")
```
/v/[token] (RSC) ─ fetchTicket(token) ─▶ get-ticket edge function
                     (service_role after a token lookup; returns a sanitized
                     TicketView — no PII beyond display_name) ─▶ renders state
buttons ─ postGuestAction ─▶ /a/[token] route ─▶ guest-action edge function
```
Guests never touch tables directly (RLS denies anon, §4.2). The page polls
`get-ticket` every 8s + on `visibilitychange`.

## Auth (§4.2)

`apps/staff/src/features/auth` — Supabase Auth (email+password). `AuthGate` gates
the app: no backend → straight through (demo); backend + no session → `LoginScreen`;
signed in → the tabs. On sign-in it loads the member's `membership` (venue + role);
`auth.uid()` + RLS then scope every read, and the SECURITY DEFINER RPCs re-check
`app_is_member(venue)` so a staff member can never act on another venue.

## Security model (RLS)

- **service_role** — bypasses RLS; used by the seed and every edge function's
  `adminClient` after a token lookup.
- **authenticated** (staff) — full DML, but the 0002 policies scope every row to
  the member's venue.
- **anon** (guest) — no table access at all; reaches data only through the edge
  functions.

Helper functions `app_is_member` / `app_is_privileged` are **SECURITY DEFINER**
(they read `memberships`, which is itself RLS-protected — without DEFINER the
policy recurses to empty). Base table GRANTs are explicit (migration `0005`): a
policy is meaningless without the underlying grant.

## Design system ("Numerek")

Tokens are law (`packages/ui-tokens/tokens.json`). Two surfaces, one world: the
staff app is the dark "service-bar instrument" (espresso surfaces, status = colour),
the guest ticket + landing are warm paper with one theatrical moment — the green
**STOLIK GOTOWY** stamp. The web consumes tokens as a generated Tailwind v4
`@theme`; the app consumes the same `tokens.json` via a NativeWind preset. No
hex/px literals outside `ui-tokens`; all copy via i18n keys.

## Notable build decisions / gotchas

- **Single React across the workspace.** Next needs React 19, Expo SDK 54 needs
  React 19.1 + RN 0.81; a pnpm `overrides` block pins react/react-dom/@types to
  one version so there's no dual-React "Invalid hook call".
- **Metro single-react resolver** (`apps/staff/metro.config.js`) — pnpm can still
  nest a 2nd React under a transitive peer (react-i18next); a resolver forces every
  `react` import to the hoisted copy.
- **Zustand v5** dropped auto-memoized selectors — derived-array selectors
  (`useActiveVisits`, …) must use `useShallow` or they loop ("getSnapshot should be
  cached").
- **Local guest read** — the local Supabase edge runtime can't reach the sibling
  `@stoliq/core` package (pnpm↔Deno mount boundary), so in **local dev** the web
  guest page reads directly via a service-role client
  (`apps/web/src/lib/ticket-direct.ts`, gated on the service key being present).
  **Production uses the deployed edge functions** (guests never get the service key).
