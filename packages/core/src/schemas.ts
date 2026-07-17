/**
 * Zod schemas — the single definition of every shape crossing a boundary.
 * Types are *inferred* from these, never hand-duplicated (§2, §12.1).
 * Row schemas mirror the Postgres tables in §4; timestamps are ISO strings
 * (store UTC, render Europe/Warsaw at the edges).
 */
import { z } from 'zod';
import {
  CHANNELS,
  ENDED_REASONS,
  GUEST_ACTIONS,
  LOCALES,
  NOTIFICATION_STATUSES,
  PLANS,
  QUOTE_SOURCES,
  ROLES,
  TEMPLATE_KEYS,
  VISIT_STATUSES,
  VISIT_TYPES,
} from './constants';

const Uuid = z.string().uuid();
const Timestamp = z.string(); // ISO-8601 UTC
const NullableTs = Timestamp.nullable();

/** +48… E.164, guest-entered (§8). Kept permissive to any valid E.164 number. */
export const PhoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Numer musi być w formacie +48…');

// ─── venues.settings (§4.1) ─────────────────────────────────────────────────
export const QuoteDefaultsSchema = z.object({
  '1-2': z.number().int().positive(),
  '3-4': z.number().int().positive(),
  '5+': z.number().int().positive(),
});
export type QuoteDefaults = z.infer<typeof QuoteDefaultsSchema>;

export const SettingsSchema = z
  .object({
    hold_minutes: z.number().int().positive().default(7),
    heads_up_position: z.number().int().positive().default(2),
    heads_up_eta_minutes: z.number().int().positive().default(8),
    retention_days: z.number().int().min(30).max(90).default(60),
    quote_defaults: QuoteDefaultsSchema.default({ '1-2': 15, '3-4': 25, '5+': 40 }),
    quote_mode: z.enum(['auto', 'manual']).default('auto'),
    channels: z
      .object({
        sms: z.boolean().default(true),
        email: z.boolean().default(false),
        push: z.boolean().default(true),
      })
      .default({ sms: true, email: false, push: true }),
    open_hours: z.unknown().nullable().default(null),
  })
  .default({});
export type Settings = z.infer<typeof SettingsSchema>;

// ─── venues ─────────────────────────────────────────────────────────────────
export const VenueSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  name: z.string().min(1),
  slug: z.string().min(1),
  city: z.string().nullable().optional(),
  plan: z.enum(PLANS),
  settings: SettingsSchema,
  sms_balance_grosz: z.number().int(),
  locale: z.enum(LOCALES),
});
export type Venue = z.infer<typeof VenueSchema>;

// ─── memberships ────────────────────────────────────────────────────────────
export const MembershipSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  user_id: Uuid,
  venue_id: Uuid,
  role: z.enum(ROLES),
  display_name: z.string().nullable().optional(),
});
export type Membership = z.infer<typeof MembershipSchema>;

// ─── guests ─────────────────────────────────────────────────────────────────
export const GuestSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  venue_id: Uuid,
  first_name: z.string().nullable().optional(),
  phone_e164: PhoneE164Schema.nullable().optional(),
  email: z.string().email().nullable().optional(),
  marketing_consent_at: NullableTs,
  purge_after: z.string(), // date
});
export type Guest = z.infer<typeof GuestSchema>;

// ─── visits (the core table §4) ─────────────────────────────────────────────
export const VisitSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  venue_id: Uuid,
  guest_id: Uuid.nullable().optional(),
  type: z.enum(VISIT_TYPES),
  status: z.enum(VISIT_STATUSES),
  party_size: z.number().int().min(1).max(30),
  display_name: z.string().nullable().optional(),
  public_token: z.string(),
  ticket_no: z.number().int(),
  rank: z.number(),
  quote_minutes: z.number().int(),
  quote_source: z.enum(QUOTE_SOURCES),
  notified_at: NullableTs,
  heads_up_sent_at: NullableTs,
  hold_expires_at: NullableTs,
  on_way_at: NullableTs,
  seated_at: NullableTs,
  ended_at: NullableTs,
  ended_reason: z.enum(ENDED_REASONS).nullable().optional(),
  reservation_at: NullableTs,
  notes: z.string().nullable().optional(),
});
export type Visit = z.infer<typeof VisitSchema>;

// ─── visit_events ───────────────────────────────────────────────────────────
export const VisitEventSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  visit_id: Uuid,
  venue_id: Uuid,
  actor: z.string(), // 'staff:<user_id>' | 'guest' | 'system'
  event: z.string(), // VisitEvent | 'undo:<event>'
  meta: z.record(z.unknown()).default({}),
});
export type VisitEventRow = z.infer<typeof VisitEventSchema>;

// ─── notifications ──────────────────────────────────────────────────────────
export const NotificationSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  visit_id: Uuid,
  venue_id: Uuid,
  channel: z.enum(CHANNELS),
  template_key: z.enum(TEMPLATE_KEYS),
  to_addr: z.string(),
  body: z.string(),
  segments: z.number().int().nullable().optional(),
  cost_grosz: z.number().int().nullable().optional(),
  status: z.enum(NOTIFICATION_STATUSES),
  provider_id: z.string().nullable().optional(),
  sent_at: NullableTs,
  error: z.string().nullable().optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ─── notification_jobs (§7.6 sweep queue) ───────────────────────────────────
export const NotificationJobSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  visit_id: Uuid,
  template_key: z.enum(TEMPLATE_KEYS),
  channel: z.enum(CHANNELS),
  run_after: Timestamp,
  attempts: z.number().int(),
  locked_at: NullableTs,
  done_at: NullableTs,
});
export type NotificationJob = z.infer<typeof NotificationJobSchema>;

// ─── message_templates ──────────────────────────────────────────────────────
export const MessageTemplateSchema = z.object({
  id: Uuid,
  created_at: Timestamp,
  venue_id: Uuid,
  key: z.enum(TEMPLATE_KEYS),
  locale: z.enum(LOCALES),
  body: z.string(),
});
export type MessageTemplate = z.infer<typeof MessageTemplateSchema>;

// ─── DTOs (client → server) ─────────────────────────────────────────────────

/** Input to the `create_visit` RPC (§4.3, §5 #1). The 5-second add. */
export const CreateVisitInputSchema = z.object({
  venue_id: Uuid,
  party_size: z.number().int().min(1).max(30),
  display_name: z.string().max(80).nullable().optional(),
  first_name: z.string().max(80).nullable().optional(),
  /** staff-confirmed quote; when omitted the server computes it (§6) */
  quote_minutes: z.number().int().min(5).max(90).optional(),
  quote_source: z.enum(QUOTE_SOURCES).default('auto'),
  type: z.enum(VISIT_TYPES).default('walk_in'),
  notes: z.string().nullable().optional(),
});
export type CreateVisitInput = z.infer<typeof CreateVisitInputSchema>;

/** Guest action from the ticket page (§7.3), rate-limited server-side. */
export const GuestActionInputSchema = z.object({
  token: z.string(),
  action: z.enum(GUEST_ACTIONS),
});
export type GuestActionInput = z.infer<typeof GuestActionInputSchema>;

/** Guest self-entered contact + optional marketing consent (§8, §11). */
export const GuestContactInputSchema = z.object({
  token: z.string(),
  phone_e164: PhoneE164Schema.optional(),
  email: z.string().email().optional(),
  marketing_consent: z.boolean().default(false),
});
export type GuestContactInput = z.infer<typeof GuestContactInputSchema>;

/** A W3C PushSubscription reduced to what the sender needs (docs/specs/push-notifications.md). */
export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;

/** Guest opts into free web-push on the ticket page — stored per visit (§7.1 push). */
export const PushSubscribeInputSchema = z.object({
  token: z.string(),
  subscription: PushSubscriptionSchema,
});
export type PushSubscribeInput = z.infer<typeof PushSubscribeInputSchema>;

/** Public shape returned by the `get-ticket` edge function (no PII beyond name). */
export const TicketViewSchema = z.object({
  venue_name: z.string(),
  status: z.enum(VISIT_STATUSES),
  ticket_no: z.number().int(),
  position: z.number().int().nullable(),
  party_size: z.number().int(),
  display_name: z.string().nullable(),
  quote_minutes: z.number().int(),
  created_at: Timestamp,
  notified_at: NullableTs,
  hold_expires_at: NullableTs,
  has_phone: z.boolean(),
  can_add_phone: z.boolean(), // venue paid + sms channel on
  // Free wallet pass is offerable: push channel on + the server has signing
  // credentials (docs/specs/push-notifications.md). Defaulted so existing
  // producers (mock/direct reads) stay valid.
  can_add_wallet: z.boolean().default(false),
  marketing_enabled: z.boolean(),
  retention_days: z.number().int(),
  locale: z.enum(LOCALES),
});
export type TicketView = z.infer<typeof TicketViewSchema>;
