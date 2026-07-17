/**
 * Enumerations and defaults shared across app / web / edge functions.
 * These mirror the DB CHECK constraints (§4) and the state machine (§5).
 * Change here → change the migration + the tables in CLAUDE.md in the same PR.
 */

// ─── Plans & roles ──────────────────────────────────────────────────────────
export const PLANS = ['free', 'pro', 'suite'] as const;
export type Plan = (typeof PLANS)[number];

export const ROLES = ['owner', 'manager', 'staff'] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed to mutate venue settings / templates / invites (§4.2). */
export const PRIVILEGED_ROLES: readonly Role[] = ['owner', 'manager'];

// ─── Visit type & status (§5) ───────────────────────────────────────────────
export const VISIT_TYPES = ['walk_in', 'reservation'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = [
  'waiting',
  'notified',
  'on_way',
  'seated',
  'no_show',
  'guest_cancelled',
  'staff_removed',
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Non-terminal statuses that count toward a live queue position (§5.1). */
export const ACTIVE_STATUSES = ['waiting', 'notified', 'on_way'] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

/** Terminal statuses — frozen except `notes` (§5). */
export const TERMINAL_STATUSES = [
  'seated',
  'no_show',
  'guest_cancelled',
  'staff_removed',
] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export const isActiveStatus = (s: VisitStatus): s is ActiveStatus =>
  (ACTIVE_STATUSES as readonly string[]).includes(s);

export const isTerminalStatus = (s: VisitStatus): s is TerminalStatus =>
  (TERMINAL_STATUSES as readonly string[]).includes(s);

// ─── ended_reason (§4) ──────────────────────────────────────────────────────
export const ENDED_REASONS = [
  'seated',
  'no_show',
  'guest_cancelled',
  'staff_removed',
] as const;
export type EndedReason = (typeof ENDED_REASONS)[number];

// ─── visit_events.event (§4) ────────────────────────────────────────────────
export const VISIT_EVENTS = [
  'created',
  'notified',
  'heads_up',
  'on_way',
  'seated',
  'no_show',
  'guest_cancelled',
  'staff_removed',
  'skipped',
  'quote_overridden',
  'hold_expired',
  'renotified',
  'delay_extended',
] as const;
export type VisitEvent = (typeof VISIT_EVENTS)[number];

// ─── Notification channels / templates / statuses (§4, §7) ──────────────────
// `push` = free best-effort web-push / wallet-pass channel (docs/specs/
// push-notifications.md): no plan gate, no wallet debit. `sms` stays the paid,
// guaranteed-reach upgrade.
export const CHANNELS = ['sms', 'email', 'push'] as const;
export type Channel = (typeof CHANNELS)[number];

export const TEMPLATE_KEYS = ['joined', 'heads_up', 'table_ready', 'renotify'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const NOTIFICATION_STATUSES = ['queued', 'sent', 'delivered', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const QUOTE_SOURCES = ['auto', 'manual'] as const;
export type QuoteSource = (typeof QUOTE_SOURCES)[number];

// ─── Guest actions (§7.3) ───────────────────────────────────────────────────
export const GUEST_ACTIONS = ['on_my_way', 'delay_5', 'cancel'] as const;
export type GuestAction = (typeof GUEST_ACTIONS)[number];

// ─── Locales ────────────────────────────────────────────────────────────────
export const LOCALES = ['pl', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pl';

// ─── Party-size brackets (§6) ───────────────────────────────────────────────
export const BRACKETS = ['1-2', '3-4', '5+'] as const;
export type Bracket = (typeof BRACKETS)[number];

// ─── Business rule limits (§5, §7) ──────────────────────────────────────────
export const LIMITS = {
  /** party_size DB CHECK (§4) */
  minPartySize: 1,
  maxPartySize: 30,
  /** guest „+5 minut" max uses (§5 #12) */
  maxDelayUses: 2,
  delayMinutes: 5,
  /** staff renotify max (§5 #7) */
  maxRenotify: 1,
  /** quote clamp (§6) */
  minQuoteMinutes: 5,
  maxQuoteMinutes: 90,
  /** heads-up ETA fallback when no seat-interval samples (§6) */
  headsUpFallbackMinutesPerPosition: 6,
  /** wait-time model needs at least this many samples to trust live data (§6) */
  minSeatSamples: 3,
  seatSampleWindowMinutes: 120,
  seatSampleCount: 10,
} as const;

// ─── Timezone (store UTC, render Europe/Warsaw — §4) ────────────────────────
export const VENUE_TIMEZONE = 'Europe/Warsaw';

/** Default venues.settings (§4.1). */
export const DEFAULT_SETTINGS = {
  hold_minutes: 7,
  heads_up_position: 2,
  heads_up_eta_minutes: 8,
  retention_days: 60,
  quote_defaults: { '1-2': 15, '3-4': 25, '5+': 40 },
  quote_mode: 'auto',
  channels: { sms: true, email: false, push: true },
  open_hours: null,
} as const;
