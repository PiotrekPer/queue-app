# Spec: Staff Live Activity — "the queue at a glance"

Status: **PLAN — no code yet.** Owner: TBD.
Relates to CLAUDE.md §9.3 (staff app), §1 (guest contract → why this is staff-only),
§5 (state machine), §14 (guest app is a non-goal). Companion to
`docs/specs/push-notifications.md` (which owns the *guest* lock-screen story).

## 1. Goal & why this is the STAFF app, not the guest

Give the waitress the live queue on her **lock screen + Dynamic Island** without
unlocking the phone: count waiting, the next party to seat, and how long the head
of the queue has waited. It is the "service-bar instrument" (§9.1) glanceable from
across the room.

**Why staff-only.** Live Activities (ActivityKit) are **native-app-only** — an
activity is started from an installed app and updated via ActivityKit / APNs.
There is no web or zero-install path, so a Live Activity would violate the guest
contract (§1: one scan, zero installs). The guest's zero-install lock-screen
channel is the **Apple Wallet pass** (see push-notifications.md). The *staff* app
is a native Expo build, so a Live Activity fits it perfectly. (Guest Live Activity
stays out of scope with the guest app, §14.)

Android has no Live Activities; the equivalent is an ongoing/updating notification
— a separate, later track (see §9). This spec is **iOS 16.1+ only**.

## 2. What it shows

Static (never changes for the life of the activity): `venueName`.
Dynamic (the ContentState, updated as the queue moves):

| Field | Example | Source |
|---|---|---|
| `waitingCount` | `6` | count of `visits` in `waiting`/`notified`/`on_way` (§5.1) |
| `nextName` | `Ania · 4 os.` | `display_name` of the lowest-rank active visit |
| `nextWaitMinutes` | `18` | now − `created_at` of that visit, rounded (§6, humble) |
| `notifiedCount` | `2` | how many are in `notified` (waiting to be seated) |

Presentations (SwiftUI in the widget extension):
- **Lock screen / banner:** venue (small) · big `W kolejce: 6` · `Następna: Ania · 4 os. · 18 min`. Status color = the head party's state color (§9.2 tokens).
- **Dynamic Island — compact:** leading = `6`, trailing = the next party's size chip.
- **Dynamic Island — expanded:** the full line above + a `Posadź` deep-link button (opens the app on the Kolejka tab, optionally pre-focused on the next card).
- **Dynamic Island — minimal:** just `6`.
- Respect Reduce Motion (§9.2): no ticker/pulse, crossfade only.

One activity per venue per device, started when the waitress opens Kolejka with a
non-empty queue; ended when the queue empties or she signs out.

## 3. Tech approach (Expo, no bare eject)

Live Activities need a native **Widget Extension** (SwiftUI + ActivityKit) — a
second Apple target — plus a JS bridge to start/update/end from the app. In an
Expo-managed project this is done with config plugins, no manual Xcode wiring:

- **`@bacons/apple-targets`** (or `bndkt/react-native-widget-extension`) — a config
  plugin that adds a `widget` target to the prebuild, with the SwiftUI
  `ActivityConfiguration` + `WidgetBundle` living in a `targets/…` folder and the
  `ActivityKit`/`SwiftUI` frameworks + `NSSupportsLiveActivities=YES` Info.plist
  key injected automatically.
- **A thin Expo Module (Swift)** exposing `startActivity(attrs, state)`,
  `updateActivity(id, state)`, `endActivity(id)` to JS via `ExpoModulesCore`.
  (Several community modules do exactly this; wrap or vendor one rather than
  writing APNs plumbing by hand.)
- Requires: `expo prebuild` (CNG), a dev client (not Expo Go — Go can't load custom
  native targets), Xcode 16+, EAS Build for device/store.

Shared data model lives in `@stoliq/core` so the Swift ContentState and the JS
caller agree on field names (mirror the table in §2 as a zod schema + TS type;
the Swift `struct` is hand-kept in sync — add it to the §12.1 "same-PR" rule).

## 4. Update strategy — phased

**Phase 1 — local updates (no server infra).** The Kolejka store
(`apps/staff/src/features/queue/store.ts`) already holds the authoritative,
realtime-reconciled list. On every queue mutation/realtime echo, derive the
ContentState (§2) and call `updateActivity`. Start on entering Kolejka with a
non-empty queue; `end` when it empties or on sign-out. This ships the whole UX
with **zero backend work** and updates live while the app is foreground or recently
backgrounded (ActivityKit allows frequent local updates for a while after
backgrounding). Good enough for the host stand, which is actively used.

**Phase 2 — APNs push updates (backgrounded for long stretches).** Each started
activity yields a **push-to-update token**; send it to the notifier
(`guest_push_targets`-style table, but staff-scoped) and have a new edge function
push ContentState updates over APNs (`apns-push-type: liveactivity`, topic
`{bundleId}.push-type.liveactivity`, ES256 auth — reuses the APNs key work already
done for Apple Wallet). Optional **push-to-start** (iOS 17.2+) so the activity can
begin from a push while the app is closed. Only needed if venues background the app
for long periods; defer until Phase 1 is validated in a pilot.

## 5. Provisioning

- No new Apple *account* cost — uses the existing Developer Program membership.
- Entitlement: `NSSupportsLiveActivities` (+ `…Frequent Updates` if we hit rate
  limits). Injected by the config plugin.
- Phase 2 only: reuse the APNs Auth Key (`.p8`) already provisioned for Apple
  Wallet; add the app's Live Activity APNs topic.

## 6. Scope, phases, estimate

- **P1 (self-contained):** config plugin + widget target + SwiftUI layouts (3
  DI presentations + lock screen) + Expo module bridge + store integration +
  tokens. ~native-heavy; the SwiftUI + plugin setup is the bulk. Ships the feature
  on-device via EAS.
- **P2 (optional):** APNs live-activity push edge function + staff token table +
  push-to-start.

## 7. Non-goals / risks

- **Not for the guest** (contract) and **not Android** (no ActivityKit; ongoing
  notification is a separate spec).
- Expo Go can't run it → requires a dev client + EAS (already how the staff app
  ships, §13/DEPLOYMENT).
- ActivityKit throttles background local updates; heavy churn may need the
  Frequent Updates entitlement or Phase 2 push.
- Keep the Swift `ContentState` struct in lockstep with the core schema (§12.1).
- v1 keeps it **read-only + one deep-link** (`Posadź`); richer in-activity actions
  (App Intents) are a later polish.
```
