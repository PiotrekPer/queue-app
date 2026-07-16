/**
 * LOCAL-DEV guest read path. When a service-role key is present server-side
 * (local Supabase), the guest page reads the ticket DIRECTLY via a service-role
 * client instead of the `get-ticket` edge function — the local edge runtime
 * can't reach the sibling `@stoliq/core` package (pnpm↔Deno mount boundary).
 *
 * This mirrors services/notifier/functions/_shared/ticket.ts exactly and reuses
 * @stoliq/core. In production the service-role key is NOT in the web app, so
 * `canUseDirect` is false and the edge function is used (guests never get direct
 * table access, §4.2). Server-only: never bundled to the client.
 */
import {
  ACTIVE_STATUSES,
  computePosition,
  TicketViewSchema,
  type Locale,
  type TicketView,
  type VisitStatus,
} from '@stoliq/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** True only when a service-role key is configured server-side (local dev). */
export const canUseDirect = url.length > 0 && serviceKey.length > 0;

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!admin) admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return admin;
}

interface VisitRow {
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
}
interface VenueRow {
  id: string;
  name: string;
  plan: string;
  locale: Locale;
  settings: {
    retention_days?: number;
    channels?: { sms?: boolean; email?: boolean };
    marketing_enabled?: boolean;
    [k: string]: unknown;
  };
}
interface GuestRow {
  phone_e164: string | null;
}

const ACTIVE = ACTIVE_STATUSES as readonly string[];

function canAddPhone(venue: VenueRow): boolean {
  const paid = venue.plan === 'pro' || venue.plan === 'suite';
  const smsOn = venue.settings.channels?.sms !== false;
  return paid && smsOn;
}

export async function getTicketDirect(token: string): Promise<TicketView | null> {
  const db = adminClient();

  const { data: v } = await db
    .from('visits')
    .select(
      'id, venue_id, guest_id, status, party_size, display_name, public_token, ticket_no, rank, quote_minutes, created_at, notified_at, hold_expires_at, on_way_at, notes',
    )
    .eq('public_token', token)
    .maybeSingle();
  const visit = (v as VisitRow | null) ?? null;
  if (!visit) return null;

  const { data: ve } = await db
    .from('venues')
    .select('id, name, plan, locale, settings')
    .eq('id', visit.venue_id)
    .maybeSingle();
  const venue = (ve as VenueRow | null) ?? null;
  if (!venue) return null;

  let hasPhone = false;
  if (visit.guest_id) {
    const { data: g } = await db
      .from('guests')
      .select('phone_e164')
      .eq('id', visit.guest_id)
      .maybeSingle();
    hasPhone = Boolean((g as GuestRow | null)?.phone_e164);
  }

  let position: number | null = null;
  if (ACTIVE.includes(visit.status)) {
    const { data: rows } = await db
      .from('visits')
      .select('rank')
      .eq('venue_id', visit.venue_id)
      .in('status', ACTIVE_STATUSES as unknown as string[]);
    const ranks = ((rows ?? []) as Array<{ rank: number }>).map((r) => r.rank);
    position = computePosition(visit.rank, ranks);
  }

  return TicketViewSchema.parse({
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
    marketing_enabled: venue.settings.marketing_enabled === true,
    retention_days: venue.settings.retention_days ?? 60,
    locale: venue.locale,
  });
}
