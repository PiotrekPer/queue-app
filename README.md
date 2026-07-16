# Stoliq

> **Staff-first virtual queue for Polish restaurants.** The waitress runs the queue from her
> phone; the guest scans a QR and gets a live _numerek_ (digital queue ticket) plus at most 3 SMS.
> No guest app, no guest login. See [`CLAUDE.md`](./CLAUDE.md) for the full product/engineering spec.

## Monorepo layout

```
stoliq/
  apps/
    staff/          # Expo app — the product (React Native + NativeWind)
    web/            # Next.js — marketing landing + guest ticket pages
  services/
    notifier/       # Supabase Edge Functions (send-notification, sweeps, purge, get-ticket, guest-action)
  packages/
    core/           # Zod schemas, state machine, wait-time, sms-segments, rank, i18n (the shared brain)
    db/             # SQL migrations, RLS, RPCs, seed, generated types
    ui-tokens/      # design tokens → Tailwind preset + RN theme (hex is law, §9.2)
```

Shared logic lives in `packages/core` and is imported everywhere — never copy-pasted.

## Prerequisites

- **Node 22 LTS** (`.nvmrc`)
- **pnpm 10** (`corepack enable` then `corepack use pnpm@10`)
- A Supabase EU (Frankfurt) project for anything hitting the backend

## Getting started

```bash
pnpm install
cp .env.example .env          # fill in Supabase / SMSAPI / Resend keys

pnpm typecheck                # tsc --noEmit across the workspace
pnpm lint                     # eslint (flat config)
pnpm test                     # vitest (core, ui-tokens, db logic)

pnpm --filter @stoliq/web dev # guest + marketing at http://localhost:3000
pnpm --filter @stoliq/staff start   # Expo dev server
```

## What is verified vs. source-complete

| Package             | State                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `@stoliq/core`      | **Runtime-verified** — full Vitest suite (§12.3 non-negotiables). |
| `@stoliq/ui-tokens` | **Runtime-verified** — generator + snapshot test.                 |
| `@stoliq/db`        | Migrations/RLS/seed authored; seed + helpers unit-tested.         |
| `@stoliq/web`       | Typechecks + builds; Playwright golden-flow scaffold.             |
| `@stoliq/staff`     | Source-complete Expo app; typechecks (device run needs EAS).      |
| `notifier`          | Edge Function source (Deno) — deploy via Supabase CLI.            |

## Conventions

The engineering working agreement (Definition of Done, golden flows, test areas, PostHog events)
lives in [`CLAUDE.md` §12](./CLAUDE.md). In short: strings via i18n keys, no hex/px literals
(tokens only), DB changes = new numbered migration + regenerated types, and the state-machine /
notification tables in `CLAUDE.md` are updated in the same PR as the code they describe.

_Made in PL/NL._
