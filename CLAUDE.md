# STOLIQ — CLAUDE.md (single source of truth)

> Working name: **Stoliq** (stolik + queue). Rename globally via `BRAND_NAME` token if needed.
> This file is the complete product, engineering, and design spec for v1 (M0–M2).
> Claude Code: read this fully before any task. When a task conflicts with this file, this file wins.
> Larger features may later split into `docs/specs/*.md`; until then, this is everything.

---

## 0. WHAT WE ARE BUILDING (one paragraph)

A **staff-first virtual queue system for Polish restaurants**. The waitress runs the queue from her own phone (native app). The guest scans a QR from the waitress's screen and gets a live "numerek" — a digital queue ticket web page — plus at most 3 SMS messages. No guest app, no guest login, no guest typing beyond an optional phone number they enter themselves. Reservations module comes in M4; the data model must support it from day one, the UI must not.

**Target user:** host/waitress at a walk-in-heavy venue (brunch, ramen, pizza) in Warsaw/Kraków/Wrocław, phone in one hand, 40 people at the door, Friday 19:00.

**Business model:** free tier = queue + status page only. Paid (149 zł/mo) = SMS notifications + heads-up message + analytics. The SMS is the paid superpower; the feature gate is the business model.

---

## 1. PRODUCT PRINCIPLES (rank-ordered; use to resolve any design/UX dispute)

1. **The guest contract:** one scan, zero typing (phone number optional, entered by guest on their own device), zero installs, max 3 messages per visit. Any feature that violates this is rejected.
2. **The 5-second add:** staff can add a party in ≤5 seconds, one-handed, walking. Every field beyond party size is optional or deferred.
3. **Never block on the network:** optimistic UI + outbox. A frozen host stand = churned customer.
4. **Honesty over precision:** show queue *position* as truth; wait estimates are rounded, humble, and never fake countdown-precision.
5. **Status is color, color is status:** the four state colors are a language; never reuse them decoratively.
6. **Polish first:** pl-PL default everywhere, en fallback. UI copy uses diacritics; SMS templates avoid them by default (cost — see §7.5).
7. **RODO is a feature, not a footer:** minimal data, guest-entered data, visible auto-purge.
8. **One bold moment per surface, everything else quiet** (see Design §9).

---

## 2. TECH STACK (exact choices — do not substitute without updating this file)

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Node 22 LTS |
| Language | TypeScript strict everywhere, `"noUncheckedIndexedAccess": true` | Single language for Claude Code efficiency |
| Staff app | **Expo (latest stable SDK)** + expo-router + React Native | iOS + Android from one codebase; EAS Build + EAS Update (OTA) |
| Styling (app) | **NativeWind v4** (Tailwind syntax in RN) | Shares mental model + tokens with web |
| Guest web + Landing | **Next.js (latest stable, App Router)** + Tailwind v4 | One app, route groups: `(marketing)` and `(guest)` |
| Backend | **Supabase — EU (Frankfurt) project** | Postgres 15+, Auth, Realtime, Edge Functions, Storage, pg_cron |
| Client data | @tanstack/react-query + Supabase js v2; **Zustand** only for ephemeral UI state | No Redux |
| Validation | **Zod** schemas in `packages/core`, shared by app/web/functions | Types are generated from schemas, not duplicated |
| SMS | **SMSAPI.pl** REST API (Polish provider, alphanumeric sender "STOLIQ") | ~0.07–0.09 zł/msg; register sender name early — takes days |
| Email | **Resend** (fallback channel, receipts, magic links via Supabase SMTP) | |
| Push (staff app) | Expo Push Notifications | Guest web: none in v1 (Android web push = M3 option) |
| Payments (M3) | Stripe Billing (web checkout; P24 + BLIK payment methods) | Never in-app purchase — B2B SaaS billed on web |
| Analytics | PostHog Cloud EU | Events listed in §12.4 |
| Errors | Sentry (app + web + functions) | |
| Testing | Vitest (unit), Playwright (guest web + landing), **Maestro** (staff app E2E flows) | Golden flows in §12.2 |
| i18n | i18next + react-i18next; locales `pl` (default), `en` | Keys in `packages/core/i18n` |
| CI | GitHub Actions: typecheck, lint (eslint+prettier), vitest, Playwright on PR; EAS build on tag | |

**Fonts** (all Google Fonts, full Polish diacritic coverage — verify ąćęłńóśźż render before shipping):
- Display: **Bricolage Grotesque** (700, 800)
- UI/body: **Schibsted Grotesk** (400, 500, 600)
- Numeric/ticket: **IBM Plex Mono** (500, 600) — ALWAYS `font-variant-numeric: tabular-nums` for positions, timers, ETAs, prices.
Load via `expo-font` in app, `next/font` on web. Subset `latin-ext`.

---

## 3. REPO STRUCTURE

```
stoliq/
  apps/
    staff/            # Expo app (the product)
      app/            # expo-router routes
      src/components/ src/features/ src/lib/
    web/              # Next.js: landing (marketing) + guest pages
      app/(marketing)/          # /, /cennik, /rodo, /kontakt
      app/(guest)/v/[token]/    # guest ticket page (perf budget: <100KB JS)
      app/(guest)/a/[token]/    # guest action endpoints (POST handlers + confirm pages)
  services/
    notifier/         # Supabase Edge Functions source: send-notification, sweep-timers, purge-guests
  packages/
    core/             # zod schemas, shared types, i18n keys, wait-time model, sms-segments util
    db/               # SQL migrations, RLS policies, seed.ts, generated types
    ui-tokens/        # design tokens (single JSON → tailwind config + RN theme)
  docs/specs/         # future feature specs
  CLAUDE.md           # this file
```

Rules: shared logic lives in `packages/core` and is imported by all apps — never copy-pasted. `packages/db` migrations are append-only SQL files, numbered.

---
## 4. DATA MODEL (Postgres / Supabase)

All tables have `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`. Timezone rule: **store UTC, render Europe/Warsaw**. Never store local time.

```sql
-- Multi-tenancy root
create table venues (
  name text not null,
  slug text unique not null,
  city text,
  plan text not null default 'free',           -- 'free' | 'pro' | 'suite'
  settings jsonb not null default '{}',        -- see §4.1
  sms_balance_grosz int not null default 0,    -- prepaid SMS wallet, integer grosz
  locale text not null default 'pl'
);

-- Staff = Supabase auth.users + membership
create table memberships (
  user_id uuid references auth.users not null,
  venue_id uuid references venues not null,
  role text not null check (role in ('owner','manager','staff')),
  display_name text,
  unique (user_id, venue_id)
);

-- Guests are venue-scoped, minimal, purgeable
create table guests (
  venue_id uuid references venues not null,
  first_name text,                              -- optional!
  phone_e164 text,                              -- optional, guest-entered, +48…
  email text,                                   -- optional
  marketing_consent_at timestamptz,             -- null = no consent (separate from service msgs)
  purge_after date not null                     -- created_at + venue retention days
);

-- THE core table. One row per party per visit. type distinguishes walk-in vs reservation.
create table visits (
  venue_id uuid references venues not null,
  guest_id uuid references guests,
  type text not null default 'walk_in' check (type in ('walk_in','reservation')),
  status text not null default 'waiting',       -- see state machine §5
  party_size int not null check (party_size between 1 and 30),
  display_name text,                            -- denormalized "Ania · 4 os."
  public_token text unique not null,            -- 16-char base58, unguessable; guest URL key
  ticket_no int not null,                       -- per-venue per-day counter, shown as "Nr 47"
  rank numeric not null,                        -- queue ordering; default extract(epoch from now())
  quote_minutes int not null,                   -- staff-confirmed at add time
  quote_source text not null default 'auto',    -- 'auto' | 'manual'
  notified_at timestamptz,
  heads_up_sent_at timestamptz,
  hold_expires_at timestamptz,                  -- notified_at + settings.hold_minutes
  on_way_at timestamptz,
  seated_at timestamptz,
  ended_at timestamptz,                         -- set on any terminal status
  ended_reason text,                            -- 'seated'|'no_show'|'guest_cancelled'|'staff_removed'
  reservation_at timestamptz,                   -- M4; null for walk_in
  notes text
);
create index on visits (venue_id, status, rank);
create index on visits (public_token);

-- Every state change + staff action. Append-only. This is analytics + ML training data.
create table visit_events (
  visit_id uuid references visits not null,
  venue_id uuid not null,
  actor text not null,                          -- 'staff:<user_id>' | 'guest' | 'system'
  event text not null,                          -- 'created','notified','heads_up','on_way','seated',
                                                -- 'no_show','guest_cancelled','staff_removed',
                                                -- 'skipped','quote_overridden','hold_expired','renotified'
  meta jsonb not null default '{}'
);

-- Outbound messages with cost accounting
create table notifications (
  visit_id uuid references visits not null,
  venue_id uuid not null,
  channel text not null check (channel in ('sms','email')),
  template_key text not null,                   -- 'joined','heads_up','table_ready','renotify'
  to_addr text not null,
  body text not null,
  segments int,                                 -- SMS only
  cost_grosz int,                               -- SMS only, from SMSAPI response
  status text not null default 'queued',        -- 'queued'|'sent'|'delivered'|'failed'
  provider_id text, sent_at timestamptz, error text
);

-- Simple job queue processed by pg_cron sweep (see §7.6)
create table notification_jobs (
  visit_id uuid not null, template_key text not null, channel text not null,
  run_after timestamptz not null default now(),
  attempts int not null default 0, locked_at timestamptz, done_at timestamptz
);

create table message_templates (
  venue_id uuid references venues not null,
  key text not null, locale text not null default 'pl',
  body text not null,                           -- with {{placeholders}}
  unique (venue_id, key, locale)
);
```

### 4.1 `venues.settings` JSON (defaults)
```json
{
  "hold_minutes": 7,
  "heads_up_position": 2,
  "heads_up_eta_minutes": 8,
  "retention_days": 60,
  "quote_defaults": { "1-2": 15, "3-4": 25, "5+": 40 },
  "quote_mode": "auto",
  "channels": { "sms": true, "email": false },
  "open_hours": null
}
```

### 4.2 Row-Level Security (non-negotiable)
- Staff (authenticated): full CRUD on rows where `venue_id in (select venue_id from memberships where user_id = auth.uid())`. Role gates: only `owner|manager` may update `venues`, `message_templates`, invite staff.
- Guest (anon): **no direct table access.** The guest page reads via Edge Function `get-ticket(token)` and mutates via `guest-action(token, action)` using `service_role` internally after token lookup. Rate-limit both: 30 req/min per token, 120 per IP.
- `visit_events`, `notifications`: insert-only from server contexts; staff can select own venue.

### 4.3 ticket_no
Per venue per day: `select coalesce(max(ticket_no),0)+1 from visits where venue_id=$1 and created_at::date = (now() at time zone 'Europe/Warsaw')::date` — wrap in the `create_visit` RPC with advisory lock to avoid races. Display as `Nr 47`.

---

## 5. VISIT STATE MACHINE (walk_in, v1)

States: `waiting → notified → on_way → seated(terminal) | no_show(terminal) | guest_cancelled(terminal) | staff_removed(terminal)`

| # | From | Event / Trigger | To | Side effects (ALL side effects, exhaustive) |
|---|---|---|---|---|
| 1 | — | Staff taps **＋ Dodaj** (create_visit RPC) | waiting | assign ticket_no, rank, public_token; compute quote (§6); event `created`; if guest later adds phone on ticket page AND settings allow → job `joined` ONLY if guest never opened ticket page within 60s (recovery message; default OFF) |
| 2 | waiting | Staff taps **Powiadom** | notified | set notified_at, hold_expires_at = now()+hold_minutes; job `table_ready` (sms if phone+plan, else nothing — ticket page updates regardless); event `notified`; haptic success |
| 3 | waiting | System: after any seating/removal recompute — party reaches position ≤ heads_up_position OR live ETA ≤ heads_up_eta_minutes, phone present, heads_up_sent_at null, paid plan | waiting (no state change) | job `heads_up`; set heads_up_sent_at; event `heads_up` |
| 4 | notified | Guest taps **„Już idziemy"** link | on_way | set on_way_at; event `on_way`; staff card turns green + haptic medium on all staff devices |
| 5 | notified/on_way | Staff swipes **Posadź** | seated | seated_at, ended_at, ended_reason 'seated'; event `seated`; recompute queue → may fire trigger #3 for others; feeds §6 rolling stats |
| 6 | waiting | Staff swipes **Posadź** (skipping notify — happens constantly) | seated | same as #5; also event `seated` with meta.skipped_notify=true |
| 7 | notified | hold_expires_at passes (sweep §7.6) | notified (no state change) | event `hold_expired`; card enters **pulsing** UI state; staff sees 3 actions: Powiadom ponownie (→ event `renotified`, new hold timer, job `renotify`, max 1 renotify), Pomiń (→ #8), Nie przyszli (→ #9) |
| 8 | waiting/notified | Staff taps **Pomiń** (skip) | waiting | rank = midpoint(rank of next two parties) → drops exactly one place; clears notified_at/hold; event `skipped`. Never punitive beyond one place. |
| 9 | notified | Staff taps **Nie przyszli** | no_show | ended_at, ended_reason; event `no_show` |
| 10 | waiting/notified/on_way | Guest taps **„Rezygnujemy"** link (+1 confirm tap) | guest_cancelled | ended_at, reason; event `guest_cancelled`; staff toast „Ania (4 os.) zrezygnowała" + light haptic; recompute |
| 11 | waiting/notified | Staff taps **Usuń** (overflow menu, confirm) | staff_removed | ended_at, reason; event `staff_removed` |
| 12 | any non-terminal | Guest taps **„+5 minut"** link | unchanged | extends hold_expires_at by 5 min (max 2 uses); event with meta.delay=5; staff card shows „+5 min" chip |

Invalid transitions must throw `409 invalid_transition` from the RPC — never silently coerce. Terminal states are frozen except `notes`.

**Undo:** every staff mutation shows a 5s toast with Cofnij. Undo = compensating transition (e.g., seated→notified restoring prior timestamps from the event log), event `undo:<original>`. Implement generically off `visit_events`.

### 5.1 Position (the number the guest sees)
`position = 1 + count(*) of visits in same venue where status in ('waiting','notified','on_way') and rank < this.rank`. Recompute server-side in `get-ticket`; staff app derives it client-side from the ordered realtime list. Skipped parties (transition #8) move down exactly one slot via fractional rank — no renumber cascade.

---

## 6. WAIT-TIME LOGIC v1 (deliberately humble)

**At add time (the quote):**
```
bracket(size)   = '1-2' | '3-4' | '5+'
seat_intervals  = seated_at deltas between consecutive seatings of same bracket,
                  same venue, trailing 120 min, last 10 samples
auto_quote      = clamp( round_to_5( median(seat_intervals) * parties_ahead_same_or_smaller_bracket
                        blended 50/50 with settings.quote_defaults[bracket] ), 5, 90 )
if samples < 3  → auto_quote = quote_defaults[bracket] (+10 if parties_ahead ≥ 6)
```
Staff sees the auto quote big on the QR screen and can tap to override in ±5 steps (`quote_source='manual'`, event `quote_overridden` with both values — this is labeled training data for M5 ML).

**On the guest ticket (live):**
- Primary truth: **position** („Jesteś 3. w kolejce").
- Secondary: `remaining = quote_minutes - elapsed`. Display rounded to 5: „ok. 15 min". If ≤ 5 → „już za chwilę" (no numbers). If overdue (remaining < -5) → „przepraszamy, jeszcze moment 🙏" and NEVER a negative/growing number.
- `heads_up ETA` used by trigger #3 = `position * median seat interval` (same stats as above), fallback 6 min/position.

**Never** show seconds. **Never** show a live countdown timer to the guest. Precision we don't have is a lie that costs trust.

---

## 7. NOTIFICATION CHOREOGRAPHY

### 7.1 Channels & gating
- Ticket web page: always live for everyone (free tier included).
- SMS: requires guest phone (guest-entered on ticket page) AND venue paid plan AND `settings.channels.sms`. Debit `venues.sms_balance_grosz` per message; at balance ≤ 500 (5 zł) email the owner; at 0, SMS silently degrades to page-only + banner in staff Settings.
- Email: optional fallback if guest gave email instead of phone (rare; supported because Warsaw inspiration used it — costs ~0).

### 7.2 The three messages (maximum per visit; renotify replaces, not adds)
| Key | Trigger | Default PL body (ASCII on purpose — §7.5) | Segments |
|---|---|---|---|
| `joined` | OFF by default (recovery only, §5 #1) | `Czesc {{name}}! Jestes w kolejce w {{venue}} (nr {{ticket_no}}). Sledz na zywo: {{link}}` | 1 |
| `heads_up` | position ≤ 2 or ETA ≤ 8 min | `{{venue}}: juz prawie! Twoj stolik bedzie gotowy za chwile. Wracaj powoli :) {{link}}` | 1 |
| `table_ready` | staff taps Powiadom | `{{venue}}: Twoj stolik jest gotowy! Mamy go dla Ciebie przez {{hold}} min. {{link}}` | 1 |
| `renotify` | staff, once max | `{{venue}}: przypominamy - stolik czeka. Dasz znac? {{link}}` | 1 |

`{{link}}` → `stq.pl/v/{token}` (short domain; buy early). All templates editable per venue in Settings with the **live segment counter** (§7.5). English variants mirror these.

### 7.3 Guest actions = signed links, never SMS replies
The ticket page (and thus every SMS via {{link}}) exposes buttons, POSTing to `guest-action`:
- `on_my_way` (visible only in notified) — one tap.
- `delay_5` — max 2 uses.
- `cancel` — two taps (button → confirm sheet „Na pewno? Stracicie miejsce").
No inbound SMS number in v1 (costs money, adds parsing). Buttons are free and instant.

### 7.4 Delivery pipeline
Staff action → RPC inserts `notification_jobs` row → pg_cron sweep (every 15s, §7.6) locks batch → Edge Function `send-notification` renders template, calls SMSAPI/Resend, writes `notifications` row with segments+cost, marks job done. Retry ×3 with backoff 30s/2m/10m, then `failed` + Sentry + staff-visible badge on the visit card („SMS nie doszedł"). Idempotency key = job id.

### 7.5 SMS segment rule (Polish cost trap — enforce in code)
GSM-7 charset → 160 chars/segment. ONE Polish diacritic (ą ć ę ł ń ó ś ź ż) forces UCS-2 → **70 chars/segment** (≈2–3× cost). `packages/core/sms-segments.ts` must export `analyze(body) → {encoding, segments, chars_left}`. Template editor shows it live and warns on UCS-2: „Znaki ą/ę/ś podwoją koszt SMS". Default templates ship diacritic-free (normal practice in PL).

### 7.6 Scheduled jobs (pg_cron)
| Job | Every | Does |
|---|---|---|
| `sweep_jobs` | 15s | process notification_jobs queue |
| `sweep_holds` | 60s | fire `hold_expired` events for notified visits past hold_expires_at |
| `sweep_heads_up` | 60s | evaluate trigger #3 (also evaluated inline after every seating) |
| `purge_guests` | daily 04:00 | delete guests past purge_after + their PII from visits.display_name; keep anonymized visit rows + events (analytics) |
| `daily_digest` | daily 06:00 | per-venue email: parties, seated, walkaways, no-shows, median wait, busiest hour, SMS spend |

---

## 8. GUEST TICKET PAGE — `/v/{token}` (the "numerek")

**Perf budget: <100KB JS, LCP <1.5s on 4G.** Server-rendered, then polls `get-ticket` every 8s + on `visibilitychange`. No login, no cookies banner needed (no tracking cookies on guest routes — PostHog only on marketing routes).

States (exhaustive):
1. **waiting** — the ticket (see design §9.4): venue name, `Nr 47`, giant position, „ok. 20 min", subtle live-dot „na żywo". Below: phone opt-in card (if no phone yet + venue paid): „📱 Dostań SMS gdy stolik będzie gotowy" + tel input (guest types own number, +48 mask) + consent microcopy: „Numer użyjemy tylko do powiadomień o tej wizycie. Auto-usunięcie po {{retention}} dniach." Marketing consent = separate unticked checkbox (only if venue enabled).
2. **notified** — green stamp moment (§9.4): „STOLIK GOTOWY", hold countdown as text („czekamy na Was do 19:42"), buttons `Już idziemy` / `+5 minut` / `Rezygnujemy`.
3. **on_way** — „Świetnie, do zobaczenia za chwilę!" + venue address line.
4. **seated** — „Smacznego! 🍽" + (if marketing consent) venue's Google review link. Page self-archives.
5. **guest_cancelled / no_show / staff_removed** — neutral: „Ta wizyta została zakończona." + „Dołącz ponownie przy wejściu."
6. **expired/unknown token** — 404 ticket: „Nie znaleźliśmy tego numerka."

`Rezygnujemy` requires confirm sheet. All actions optimistic with rollback on 409.

---
## 9. DESIGN SYSTEM — "NUMEREK"

### 9.0 Industry benchmarks (what we steal, what we reject)
| Reference | What it proves | We take | We reject |
|---|---|---|---|
| **Toast POS** (US restaurant OS) | Software for loud, dim, greasy-fingered rooms: chunky targets, status-color language, speed over beauty | 56px+ touch targets, color-as-state, dark-room-first | Enterprise visual blandness |
| **Resy** | Restaurant tech can have editorial confidence — big type, appetite, taste | Landing typography courage | Consumer-app discovery chrome |
| **Fresha** (salon SaaS) | SMB service tools can feel consumer-grade polished; owners choose the pretty one | Overall polish bar for a 149 zł/mo product | Feature sprawl |
| **Linear** | Dark UI precision: restraint, motion discipline, keyboard-speed ethos → our thumb-speed ethos | Motion restraint, crisp borders, "fast is a feature" | Its cool blue-black palette (ours is warm) |
| **Domino's Pizza Tracker + Uber trip screen** | The status-screen genre: visible progress reduces anxiety and "speeds up time"; it's the pattern every service business asks to copy | The guest ticket IS our pizza tracker | Cartoon gamification — Polish dining wants calm, not confetti |
| **Carbonara App** | Validates free+friendly in EU restaurants | Friendliness | Cluttered screens, generic-app feel |

**Positioning in one line:** *Toast's durability × Linear's discipline × the Pizza Tracker's calm, wearing the visual clothes of a Polish restaurant at night.*

### 9.1 The vibe (write code that feels like this)
Two surfaces, one world:
- **Staff app — „the service-bar instrument."** A dark, warm tool that belongs next to a POS terminal at 20:00: espresso-dark surfaces (warm brown-black, never blue-black), text the color of steamed milk, and the four status colors glowing like indicator lamps. Zero decoration. Everything big, everything instant, everything undoable. It should feel closer to a well-machined kitchen timer than to a SaaS dashboard.
- **Guest ticket & landing — „the numerek."** Every Pole knows the paper numerek from the deli, pharmacy, post office. We make it beautiful: warm paper, mono digits like a receipt printer, and one theatrical moment — the green **STOLIK GOTOWY** stamp. Calm, a little witty, dignified. The anti-anxiety screen.
- **The signature element** (the one bold thing, everything else stays quiet): the **ticket motif** — giant tabular mono digits + the stamp animation. It appears on the guest page, as the staff QR screen, in the app icon, and as the landing hero. Nothing else in the product is allowed to be theatrical.

### 9.2 Tokens (`packages/ui-tokens/tokens.json` → Tailwind config + RN theme; hex is law)
```jsonc
{
  "color": {
    // Dark surface (staff app)
    "espresso":   "#151210",  // app background — warm brown-black
    "walnut":     "#201B18",  // cards
    "walnut-hi":  "#2A241F",  // pressed / elevated
    "hairline":   "rgba(244,239,231,0.08)",
    "steam":      "#F4EFE7",  // primary text on dark
    "smoke":      "#9A9088",  // secondary text on dark
    // Paper surface (guest + landing)
    "paper":      "#F6F1E7",  // background
    "paper-hi":   "#FFFCF5",  // cards on paper
    "ink":        "#1A1512",  // text on paper
    "ink-soft":   "#5C544C",
    // Status = language (dark-surface value / paper-surface value)
    "waiting":    { "dark": "#6AA1E0", "paper": "#2F6FBF" },   // cool info blue
    "notified":   { "dark": "#E8A23D", "paper": "#9A6A1C" },   // tungsten amber
    "ready":      { "dark": "#3ECC7E", "paper": "#177A47" },   // GO green — also brand accent
    "ready-fill": "#1F9D5B",
    "danger":     { "dark": "#E5484D", "paper": "#B3261E" },
    "neutral-end":"#8F867C"   // terminal/cancelled
  },
  "radius": { "card": 16, "control": 12, "pill": 999, "ticket": 20 },
  "space": 4,                 // 4pt grid, sizes = 4·n
  "touch": { "min": 48, "primary": 56, "seatSwipe": 72 },
  "type": {
    "display": "Bricolage Grotesque", "ui": "Schibsted Grotesk", "mono": "IBM Plex Mono",
    "scale": { "ticketNo": 72, "position": 96, "h1": 40, "h2": 28, "cardName": 20,
               "body": 17, "small": 15, "caption": 13, "timer": 24 }
  },
  "motion": {
    "fast": "160ms cubic-bezier(0.2,0,0,1)",
    "emph": "240ms cubic-bezier(0.2,0.9,0.3,1.15)",
    "stamp": "keyframes: scale 1.4→1, rotate -8deg→-3deg, opacity 0→1, 240ms emph",
    "pulse": "hold-expired card: shadow+border notified color, scale 1→1.015, 1.2s loop",
    "ticker": "digits roll vertically 160ms on change (position, timers)"
  }
}
```
Brand accent = `ready` green: *the brand color is literally the color of good news.* Never use green decoratively; if something is green, a table is ready or an action succeeded. Respect `prefers-reduced-motion` / RN Reduce Motion: disable pulse/ticker/stamp scale (crossfade only).

Contrast floor: all text AA (4.5:1); status colors on their surfaces are pre-checked above — don't invent new pairings.

### 9.3 Staff app — screen-by-screen

**Navigation:** bottom tabs `Kolejka` (default) · `Dziś` · `Ustawienia`. Dark theme only in v1 (it's a dim-room tool; light theme = M3 setting).

**A. Kolejka (home).**
- Header: venue name (small, smoke) + live party count pill `W kolejce: 6` + big `＋ Dodaj` button (ready-fill, 56px, right thumb zone).
- The rail: vertical list of **ticket cards** (walnut, radius 16, 12px gap). Card anatomy (min height 88px):
  - Left edge: 4px status color bar (the indicator lamp).
  - Row 1: `Ania · 4 os.` (cardName 20/600, steam) + `Nr 47` (mono 15, smoke, right).
  - Row 2: status chip (`Czeka` waiting-blue / `Powiadomiono 2:41` amber with **countdown ring** 20px around a bell icon / `W drodze` ready-green / `+5 min` chip) + elapsed vs quote: `12 / 25 min` mono tabular — elapsed turns amber when > quote (host's early-warning system).
  - Actions: primary button right side context-aware — `Powiadom` (waiting) → `Posadź` (notified/on_way). **Swipe right = Posadź** always: swipe reveals full-height ready-fill zone with chair glyph; on release card does a 240ms "tear-off" (translate-x + fade). Swipe left reveals `Pomiń` / `Usuń`.
  - Every action → toast with `Cofnij` (5s).
- Hold-expired card: pulse animation + inline 3-button row (Powiadom ponownie / Pomiń / Nie przyszli).
- Empty state: big outline numerek graphic, „Pusta kolejka. Miły widok — albo cisza przed burzą." + `＋ Dodaj`.
- Realtime: list subscribes to Supabase realtime on visits (venue channel). Two devices must feel like one — this is the sales demo.

**B. Add flow (the sacred path — ≤5s, one hand).** Full-screen modal, 2 steps max:
1. Party size: 3×3 grid of giant number buttons 1–8 + `9+` (opens stepper). Tap → advance automatically.
2. Name: single field, autofocus, `Pomiń →` equally prominent. Done →
3. **QR screen:** paper-colored full-bleed ticket (the ONLY light screen in the app — max scan contrast + it's literally handing the guest a ticket): QR (240px) center, `Nr 47` mono 72 top, auto-quote bottom in huge type „~25 min" (tap to adjust ±5 → quote_source=manual), `Gotowe` closes. Screen brightness auto-boosts while visible. Phone number is deliberately absent from this flow (§1.1).

**C. Dziś (today).** Stat strip (mono): `Przyjęte 84 · Posadzone 71 · Rezygnacje 9 · No-show 4 · Mediana 19 min`. Below: finished-visits list (neutral). Rich analytics live in the daily email, not here.

**D. Ustawienia.** Venue basics; hold timer & heads-up thresholds; quote defaults per bracket; message templates with **live segment counter** (§7.5) and warning state; staff invites (owner/manager only); channels + SMS balance with top-up link (web); **RODO card**: retention slider 30/60/90 + „Dane gości usuwamy automatycznie" copy + link to DPA (umowa powierzenia) PDF; plan & billing (opens web).

**Haptics map (expo-haptics):** add=light · seat=success · guest on_way=medium · hold expired=warning ×2 · undo=selection. Never more.

### 9.4 Guest ticket page — visual spec
Paper background. Centered ticket card (paper-hi, radius 20, subtle 1px ink@8% border) with a **perforated top edge** (CSS mask dotted cutout — the one skeuomorphic detail allowed, it earns its place). Inside, top→down:
- Venue name — Bricolage 28/700, ink.
- `NUMEREK 47` — caption, letterspaced 0.08em, ink-soft.
- **Position** — mono 96/600, ink, ticker-roll on change: `3.` with „w kolejce" caption. THE element.
- Wait line — body 17: „ok. 20 min" / „już za chwilę".
- live-dot + „na żywo" caption (pulsing 2s ready-green dot).
- Then the phone opt-in card or action buttons per state (§8).
**The stamp (notified state):** position block is replaced by a rotated (-3°) rounded rect, ready-fill bg, paper text: **„STOLIK GOTOWY"** Bricolage 32/800 — enters with `motion.stamp` once. Below: hold deadline text + 3 buttons (Już idziemy = ready-fill primary; +5 minut = outline; Rezygnujemy = ghost danger, confirm sheet). This is the product's one theatrical moment; nothing else on the page moves.
Footer, tiny: „Stoliq · Twoje dane znikną automatycznie po {{retention}} dniach · RODO".

### 9.5 Voice & microcopy rules
Warm-direct Polish, „Ty" form to guests, zero corporate-speak, at most one emoji per message. Buttons say what happens: `Posadź`, `Powiadom`, `Już idziemy` — never `OK/Submit/Wyślij`. Errors state fact + fix: „SMS nie doszedł. Sprawdź numer albo powiadom ponownie." Same verb across the whole flow (Powiadom → „Powiadomiono"). All strings via i18n keys; no literals in JSX.

---

## 10. LANDING PAGE — `apps/web/(marketing)/` 

**Job:** one venue owner, tired, on a phone at 23:30, decides to try it for Friday. Audience: właściciel/manager. Language: PL (EN switch in footer). Paper/ink/ready palette — the landing and the guest ticket are visibly the same world; the product demos itself.

**Hero = the signature, a playable demo (no screenshot, no stock photo):**
- Left (or top on mobile): H1 Bricolage 40–56/800: **„Koniec z kolejką pod drzwiami."** Sub 17: „Goście skanują numerek, idą na spacer i wracają dokładnie na swój stolik. Ty prowadzisz kolejkę z telefonu." CTA primary (ready-fill): `Wypróbuj za darmo` → app stores/onboarding; ghost: `Zobacz demo 90 s`.
- Right: **live mini host-stand:** a phone-frame with 3 fake queue cards; visitor taps `Powiadom` on „Ania · 4 os." → beside it a mini guest ticket flips to the STOLIK GOTOWY stamp in realtime. Fully client-side, keyboard accessible, ~15 lines of state. This one interaction explains the entire product.
- Eyebrow above H1, mono caption: `SYSTEM KOLEJKOWY I POWIADOMIENIA SMS · DLA GASTRONOMII`.

**Section 2 — the pain, in their numbers (paper, generous whitespace):** three mono stat cards, sourced honestly: „~20 min — tyle goście czekają, zanim rezygnują" · „72% nie zaczeka dłużej niż 30 min" · „5 straconych stolików dziennie ≈ 100 000+ zł rocznie". One-line source captions. No icons-for-the-sake-of-icons.

**Section 3 — Jak to działa (the only numbered section — it IS a sequence):** 1 `Dodajesz gości w 5 sekund` (add-flow visual) · 2 `Gość skanuje numerek` (ticket visual) · 3 `SMS ściąga ich z powrotem` (phone bubble: the heads-up message verbatim). Each step = real UI, not illustration.

**Section 4 — Dla kelnerki, nie dla informatyka:** dark espresso band (the app's world intrudes): screenshot rail of Kolejka/QR/Dziś, copy on multi-device sync „Dwa telefony, jedna kolejka. Na żywo." This band is the only dark section — contrast makes both worlds legible.

**Section 5 — Cennik (flat, honest — anti-commission positioning):** three paper cards: **Start 0 zł** (kolejka + strona numerka, bez SMS) · **Pro 149 zł netto/mc** „najczęściej wybierany" ready-green border (SMS w cenie: 500/mc, heads-up, statystyki dzienne, 2 urządzenia+) · **Suite 299 zł netto/mc** (rezerwacje — „wkrótce", zadatki, eksport gości). Under cards, one line: „Zero prowizji od osoby. Stała cena. Rezygnujesz kiedy chcesz." + SMS overage „0,15 zł/SMS po pakiecie".

**Section 6 — RODO trust block:** short, factual: dane w UE (Frankfurt), auto-usuwanie 30/60/90 dni, gotowa umowa powierzenia w cenie, gość sam podaje numer. This section closes Polish owners' #1 objection.

**Section 7 — Case study slot:** component built now, filled after pilots: „{{Venue}}, {{city}}: rezygnacje −{{x}}% w 4 tygodnie" + owner quote + photo. Until real data: render honest placeholder „Pilotaż trwa — wyniki wkrótce" (never fake logos/testimonials).

**Section 8 — FAQ (accordion, real questions):** Co jeśli gość nie ma smartfona? (kelnerka woła jak zwykle — system nie przeszkadza) · Ile kosztują SMS-y? · Czy goście muszą coś instalować? (Nie. Nic.) · Co z RODO? · Działa bez internetu? (aplikacja ma tryb offline na chwilowe zaniki).

**Footer:** ink on espresso; contact, Regulamin, Polityka prywatności, Umowa powierzenia (PDF), language switch, „Made in PL/NL".

**SEO/meta:** title „Stoliq — system kolejkowy i powiadomienia SMS dla restauracji"; target phrases: *system kolejkowy dla restauracji, wirtualna kolejka, powiadomienia SMS o stoliku, aplikacja do kolejki gastronomia*. OG image = the ticket with stamp. Marketing routes may use PostHog; guest routes stay tracker-free.

---
## 11. RODO / PRIVACY IMPLEMENTATION (build these, not just words)

- Roles: venue = administrator (controller), Stoliq = podmiot przetwarzający (processor). Ship `docs/legal/umowa-powierzenia.md` → PDF, accepted at venue signup (checkbox + timestamp stored on venues).
- Data minimization: guest = optional first name + optional phone/email. Nothing else. No birthday fields, no addresses, ever in v1.
- Guest enters own contact data on own device (§8) — cleaner basis + faster staff flow. Service notifications = performance of service; **marketing consent is a separate, unticked checkbox** stored as `marketing_consent_at` (Polish e-communications law requires separate consent for marketing).
- `purge_guests` cron (§7.6): hard-delete PII after `retention_days`; anonymize `visits.display_name` → `Gość`. Events/notifications keep only non-PII meta. Surface it: Settings RODO card + guest-page footer.
- Data export: owner can email-request CSV of own venue guests (M3 self-serve; manual until then).
- Supabase project region **eu-central-1 (Frankfurt)**; SMSAPI is a Polish processor — list both in the privacy policy's subprocessor table.

## 12. ENGINEERING CONVENTIONS (Claude Code working agreement)

### 12.1 Definition of Done — every task
1. `pnpm typecheck && pnpm lint && pnpm test` pass at repo root.
2. New logic in `packages/core` or `services/` has Vitest coverage; UI logic has at least a smoke test.
3. Strings via i18n keys (pl + en added together). No hex/px literals — tokens only.
4. DB changes = new numbered migration + RLS reviewed + `pnpm db:types` regenerated.
5. State-machine or notification changes update the tables in §5/§7 of THIS FILE in the same PR.
6. Screenshots (Maestro/Playwright) attached for UI-visible changes.

### 12.2 Golden flows (Maestro `apps/staff/.maestro/` + Playwright `apps/web/e2e/`)
1. Add party (size→skip name→QR) → card appears on second logged-in device ≤2s.
2. Powiadom → guest page (Playwright, same seed) flips to STOLIK GOTOWY → tap „Już idziemy" → staff card turns green.
3. Hold expiry: fake clock → card pulses → „Nie przyszli" → terminal + Dziś stats update.
4. Guest cancels → staff toast → positions of remaining parties shift correctly.
5. Skip: 4-party queue, skip #1 → order becomes 2,1,3,4 (rank midpoint verified).
6. Offline: airplane-mode add + seat → outbox flush on reconnect, zero data loss, no dupes.
7. Template editor: adding „ą" flips counter to UCS-2/70 and shows the cost warning.

### 12.3 Non-negotiable unit-test areas (write cases first)
`state-machine.ts` (every legal + illegal transition from §5) · `wait-time.ts` (fixtures incl. <3 samples, clamping, DST days **2026-03-29** and **2026-10-25** Europe/Warsaw) · `sms-segments.ts` (GSM-7 vs UCS-2 boundary strings) · `rank.ts` (skip midpoint, float exhaustion → rebalance) · RLS (pgTAP or supabase test helpers: staff A cannot read venue B).

### 12.4 PostHog events (staff app + marketing only — never guest routes)
`visit_created {party_size, quote, source}` · `visit_notified` · `visit_seated {waited_min, skipped_notify}` · `visit_no_show` · `guest_cancelled` · `hold_expired` · `quote_overridden {auto, manual}` · `sms_sent {segments}` · `template_edited {encoding}` · landing: `demo_played`, `cta_clicked {tier}`.

### 12.5 Environment
```
SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (functions only)
SMSAPI_TOKEN / SMS_SENDER=STOLIQ
RESEND_API_KEY
GUEST_BASE_URL=https://stq.pl
SENTRY_DSN_APP / SENTRY_DSN_WEB / POSTHOG_KEY_EU
```
Secrets never in app bundle; guest links built server-side.

### 12.6 Seed data — `packages/db/seed.ts` (Claude Code: run before any UI work)
Venue **„Trattoria Demo"** (Warszawa, plan pro, sms_balance 5000, defaults §4.1) + owner `demo@stoliq.app` / staff `kelner@stoliq.app` (password `stoliq-demo-1`, also used for App Store review). Generate a realistic Friday: 30 visits across 17:00–21:00 (sizes weighted 2>4>3>1>5+), statuses mixed (5 active in queue now, rest terminal with plausible timestamps), matching visit_events and notifications so Dziś, guest pages, and the digest email all render with life in them. Deterministic faker seed = 47.

## 13. MILESTONES (scope fence for this file)

- **M0 (weekend):** monorepo, Supabase project + migrations §4, RLS, seed, CI, tokens package, fonts render ąćęłńóśźż.
- **M1 (2–3 wks):** Kolejka + Add flow + QR screen; realtime multi-device; state machine transitions 1,2,4,5,6,10,11; guest page states 1–4; notification pipeline + `table_ready` SMS end-to-end on a real Polish number.
- **M2 (2 wks):** hold sweep + expiry UI + renotify/skip/no-show (3,7,8,9,12); heads-up trigger; outbox/offline; Dziś; Settings incl. template editor + segment counter; RODO purge + digest email; TestFlight/Internal testing → **pilot in 2–3 real venues**.
- **M3:** store release, Stripe billing (P24/BLIK), self-serve venue onboarding, guest self-join QR mode (optional per venue), landing case-study section goes live.
- **M4:** reservations module (visits.type='reservation', availability engine — separate spec `docs/specs/m4-reservations.md` before any code).

## 14. NON-GOALS v1 (do not build, do not scaffold "for later")
Guest mobile app · table/floor plans · POS integrations · inbound SMS · WhatsApp (M3+ decision) · multi-venue dashboards · iPad-specific layouts (responsive is enough) · light theme · English SMS templates auto-detect · loyalty · deposits/payments from guests · AI wait predictions (heuristics §6 only — collect events first).

---
*End of spec. If reality contradicts this file, update the file in the same PR.*
