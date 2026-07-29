/**
 * Unified `push` channel delivery (docs/specs/push-notifications.md).
 *
 * One free, best-effort channel with three transports, chosen by whatever the
 * guest actually opted into — there is no per-transport job:
 *   • webpush       — Android/desktop browsers (webpush.ts)
 *   • apple_wallet  — the iOS zero-install path (apple-wallet.ts)
 *   • google_wallet — Android wallet (google-wallet.ts)
 *
 * Semantics (§7.1 amended): push never gates on plan and never debits the SMS
 * wallet. "No targets at all" is a silent success — the guest simply never
 * opted in, and the live page is still the source of truth (§1: never block).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale, TemplateKey, VisitStatus } from '@stoliq/core';
import { sendPushForVisit } from './webpush.ts';
import { sendApplePassUpdate } from './apple-wallet.ts';
import { sendGooglePassUpdate } from './google-wallet.ts';
import { computeVisitPosition, type VisitRow } from './ticket.ts';
import type { PassModel } from '@stoliq/core';

export interface DeliverPushInput {
  visitId: string;
  venueName: string;
  locale: Locale;
  /** Rendered template text — the web-push notification body. */
  rendered: string;
  /** Live ticket URL — the notification's tap target and the pass's barcode. */
  ticketUrl: string;
  /** Which template fired — decides whether the wallet pass rings (§7.2). */
  templateKey: TemplateKey;
}

/** Templates that earn a phone-ringing wallet notification (§7.2); every other
 *  push updates the pass content silently (Google PATCH, unlimited/free). */
const GOOGLE_NOTIFY_TEMPLATES = new Set<TemplateKey>(['heads_up', 'table_ready', 'renotify']);

export interface DeliverPushResult {
  ok: boolean;
  /** Total targets that accepted, across all transports. */
  sent: number;
  /** Short per-transport tally for the notifications row (`to_addr`). */
  detail: string;
  error: string | null;
}

/** Load the full visit row the pass model needs (status + rank for position). */
async function loadVisitRow(db: SupabaseClient, visitId: string): Promise<VisitRow | null> {
  const { data, error } = await db
    .from('visits')
    .select(
      'id, venue_id, guest_id, status, party_size, display_name, public_token, ' +
        'ticket_no, rank, quote_minutes, created_at, notified_at, hold_expires_at, ' +
        'on_way_at, notes',
    )
    .eq('id', visitId)
    .maybeSingle();
  if (error) throw error;
  return (data as VisitRow | null) ?? null;
}

/**
 * Fan one notification out to every push transport the guest opted into.
 * Aggregates into a single outcome so the caller writes exactly one
 * `notifications` row for the push channel.
 */
export async function deliverPushForVisit(
  db: SupabaseClient,
  input: DeliverPushInput,
): Promise<DeliverPushResult> {
  const visit = await loadVisitRow(db, input.visitId);
  if (!visit) {
    return { ok: false, sent: 0, detail: '', error: 'visit_gone' };
  }

  const position = await computeVisitPosition(db, visit);

  const model: PassModel = {
    serial: visit.public_token,
    venueName: input.venueName,
    ticketNo: visit.ticket_no,
    status: visit.status as VisitStatus,
    position,
    ticketUrl: input.ticketUrl,
    locale: input.locale,
  };

  // Independent transports — one failing must never suppress the others.
  const [web, apple, google] = await Promise.all([
    sendPushForVisit(db, visit.id, {
      title: input.venueName,
      body: input.rendered,
      url: input.ticketUrl,
    }),
    sendApplePassUpdate(db, visit.id),
    sendGooglePassUpdate(db, visit.id, model, {
      notify: GOOGLE_NOTIFY_TEMPLATES.has(input.templateKey),
    }),
  ]);

  const sent = web.sent + apple.sent + google.sent;
  const errors = [web.error, apple.error, google.error].filter(
    (e): e is string => e !== null,
  );

  return {
    ok: sent > 0 || errors.length === 0,
    sent,
    detail: `web:${web.sent} apple:${apple.sent} google:${google.sent}`,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}
