/**
 * Shared guest-facing helpers: load a visit by public_token, compute its live
 * queue position, and build the sanitized `TicketView` (§8). Used by both
 * `get-ticket` (read) and `guest-action` (mutate → return fresh view).
 *
 * PII discipline (§4.2, §11): the TicketView leaks nothing beyond `display_name`
 * (already denormalized + guest-visible on their own ticket) and never the
 * guest's phone/email or another party's identity.
 */
import {
  ACTIVE_STATUSES,
  computePosition,
  TicketViewSchema,
  type Locale,
  type TicketView,
  type VisitStatus,
} from '@stoliq/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Row shape we select from `visits` for token lookups. */
export interface VisitRow {
  id: string;
  venue_id: string;
  guest_id: string | null;
  status: VisitStatus;
  party_size: number;
  display_name: string | null;
  public_token: string;
  ticket_no: number;
  rank: number;
  quote_minutes: number;
  created_at: string;
  notified_at: string | null;
  hold_expires_at: string | null;
  on_way_at: string | null;
  notes: string | null;
  delay_uses?: number;
}

/** Venue fields the ticket needs (plan/settings/name/locale). */
export interface VenueRow {
  id: string;
  name: string;
  plan: string;
  locale: Locale;
  settings: {
    retention_days?: number;
    channels?: { sms?: boolean; email?: boolean };
    marketing_enabled?: boolean;
    hold_minutes?: number;
    [k: string]: unknown;
  };
}

/** Guest fields we consult (never returned to the client). */
export interface GuestRow {
  id: string;
  phone_e164: string | null;
  email: string | null;
  marketing_consent_at: string | null;
}

const ACTIVE = ACTIVE_STATUSES as readonly string[];

/** Look up a visit by its public token. Returns null when unknown/expired. */
export async function loadVisitByToken(
  db: SupabaseClient,
  token: string,
): Promise<VisitRow | null> {
  const { data, error } = await db
    .from('visits')
    .select(
      'id, venue_id, guest_id, status, party_size, display_name, public_token, ticket_no, rank, quote_minutes, created_at, notified_at, hold_expires_at, on_way_at, notes',
    )
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  return (data as VisitRow | null) ?? null;
}

export async function loadVenue(db: SupabaseClient, venueId: string): Promise<VenueRow | null> {
  const { data, error } = await db
    .from('venues')
    .select('id, name, plan, locale, settings')
    .eq('id', venueId)
    .maybeSingle();
  if (error) throw error;
  return (data as VenueRow | null) ?? null;
}

export async function loadGuest(
  db: SupabaseClient,
  guestId: string | null,
): Promise<GuestRow | null> {
  if (!guestId) return null;
  const { data, error } = await db
    .from('guests')
    .select('id, phone_e164, email, marketing_consent_at')
    .eq('id', guestId)
    .maybeSingle();
  if (error) throw error;
  return (data as GuestRow | null) ?? null;
}

/**
 * Live position of this visit among the venue's active queue (§5.1):
 * `1 + count(active rank < this.rank)`. Terminal visits have no position (null).
 */
export async function computeVisitPosition(
  db: SupabaseClient,
  visit: VisitRow,
): Promise<number | null> {
  if (!ACTIVE.includes(visit.status)) return null;

  const { data, error } = await db
    .from('visits')
    .select('rank')
    .eq('venue_id', visit.venue_id)
    .in('status', ACTIVE_STATUSES as unknown as string[]);

  if (error) throw error;
  const ranks = ((data ?? []) as Array<{ rank: number }>).map((r) => r.rank);
  return computePosition(visit.rank, ranks);
}

/** Whether the venue can offer SMS opt-in on the ticket (§7.1 gating). */
export function canAddPhone(venue: VenueRow): boolean {
  const paid = venue.plan === 'pro' || venue.plan === 'suite';
  const smsOn = venue.settings.channels?.sms !== false;
  return paid && smsOn;
}

/**
 * Free wallet pass is offerable when the push channel is on AND the server can
 * actually sign a pass (docs/specs/push-notifications.md). No plan gate — push
 * is free on every tier. Never advertise a button that would 501.
 */
export function canAddWallet(venue: VenueRow): boolean {
  const pushOn = venue.settings.channels?.push !== false;
  const appleReady = Boolean(
    Deno.env.get('APPLE_PASS_TYPE_ID') && Deno.env.get('APPLE_PASS_CERT_P12'),
  );
  const googleReady = Boolean(
    Deno.env.get('GOOGLE_WALLET_ISSUER_ID') && Deno.env.get('GOOGLE_WALLET_SA_PRIVATE_KEY'),
  );
  return pushOn && (appleReady || googleReady);
}

/**
 * Assemble + validate the public TicketView (§8). `guest` may be null (no phone
 * yet). Validation with `TicketViewSchema` guarantees we never accidentally add
 * a PII field to this boundary.
 */
export function buildTicketView(
  visit: VisitRow,
  venue: VenueRow,
  guest: GuestRow | null,
  position: number | null,
): TicketView {
  const hasPhone = Boolean(guest?.phone_e164);
  const view: TicketView = {
    venue_name: venue.name,
    status: visit.status,
    ticket_no: visit.ticket_no,
    position,
    party_size: visit.party_size,
    display_name: visit.display_name ?? null,
    quote_minutes: visit.quote_minutes,
    created_at: visit.created_at,
    notified_at: visit.notified_at,
    hold_expires_at: visit.hold_expires_at,
    has_phone: hasPhone,
    can_add_phone: canAddPhone(venue) && !hasPhone,
    can_add_wallet: canAddWallet(venue),
    marketing_enabled: venue.settings.marketing_enabled === true,
    retention_days: venue.settings.retention_days ?? 60,
    locale: venue.locale,
  };
  return TicketViewSchema.parse(view);
}
