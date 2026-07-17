/**
 * guest-action (§7.3, §8, §5) — the guest ticket page's mutation endpoint.
 *
 * Two POST shapes on the same route, discriminated by body:
 *  1. Action:      { token, action }  where action ∈ on_my_way | delay_5 | cancel
 *                  → mapped to a TransitionIntent, run through describeTransition,
 *                    timestamps applied, visit_events row inserted (actor 'guest').
 *  2. Set-contact: { token, phone_e164?, email?, marketing_consent }
 *                  → upsert a guests row, link it to the visit, store
 *                    marketing_consent_at only when consented (§11 separate basis).
 *
 * All actions are signed-link driven (the token IS the signature, §7.3); no
 * inbound SMS. Rate-limited 30/min per token, 120/min per IP. Every response is
 * a fresh TicketView so the optimistic UI can reconcile (or roll back on 409).
 */
import {
  describeTransition,
  GuestActionInputSchema,
  GuestContactInputSchema,
  InvalidTransitionError,
  isTerminalStatus,
  LIMITS,
  PushSubscribeInputSchema,
  type GuestAction,
  type TransitionIntent,
} from '@stoliq/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTicketView,
  canAddPhone,
  computeVisitPosition,
  loadGuest,
  loadVenue,
  loadVisitByToken,
  type VisitRow,
} from '../_shared/ticket.ts';
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json, preflight } from '../_shared/cors.ts';
import { checkGuestRate, clientIp, rateLimitHeaders } from '../_shared/ratelimit.ts';

/** Guest action → state-machine intent (§5 #4/#10/#12). */
const ACTION_INTENT: Record<GuestAction, TransitionIntent> = {
  on_my_way: 'guest_on_way',
  cancel: 'guest_cancel',
  delay_5: 'guest_delay',
};

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return json(errorBody('method_not_allowed'), 405);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(errorBody('invalid_json'), 400);
  }

  // Discriminate the three body shapes on this route:
  //   `action`       → a state-machine transition
  //   `subscription` → a free web-push opt-in (docs/specs/push-notifications.md)
  //   otherwise      → a set-contact submission (phone/email + consent)
  const asObj =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
  const isAction = asObj !== null && 'action' in asObj;
  const isPush = asObj !== null && 'subscription' in asObj;

  const token =
    typeof raw === 'object' && raw !== null
      ? String((raw as Record<string, unknown>).token ?? '').trim()
      : '';
  if (!token) {
    return json(errorBody('missing_token'), 400);
  }

  const rate = checkGuestRate(token, clientIp(req));
  if (!rate.ok) {
    return json(errorBody('rate_limited'), 429, rateLimitHeaders(rate));
  }

  try {
    const db = adminClient();
    if (isAction) return await handleAction(db, raw);
    if (isPush) return await handlePushSubscribe(db, raw);
    return await handleContact(db, raw);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return json(errorBody(err.code, err.message), err.httpStatus);
    }
    console.error('[guest-action] error', err);
    return json(errorBody('internal_error'), 500);
  }
});

// ── action path ───────────────────────────────────────────────────────────────

async function handleAction(db: SupabaseClient, raw: unknown): Promise<Response> {
  const parsed = GuestActionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return json(errorBody('invalid_input', parsed.error.message), 400);
  }
  const { token, action } = parsed.data;

  const visit = await loadVisitByToken(db, token);
  if (!visit) return json(errorBody('not_found'), 404);

  const intent = ACTION_INTENT[action];

  // Guard context the machine needs: delay uses come from the event log (#12).
  const delayUses =
    intent === 'guest_delay' ? await countDelayUses(db, visit.id) : undefined;

  const effect = describeTransition(intent, visit.status, { delayUses });

  // Apply the effect: timestamps, hold extension, status, then the event row.
  const patch: Record<string, unknown> = {};
  const nowIso = new Date().toISOString();
  for (const col of effect.setTimestamps) patch[col] = nowIso;
  for (const col of effect.clearTimestamps) patch[col] = null;
  if (effect.stateChanged) patch.status = effect.status;

  // #12 delay: extend the hold deadline by +5 min (never a status change).
  if (intent === 'guest_delay') {
    patch.hold_expires_at = extendHold(visit.hold_expires_at, LIMITS.delayMinutes);
  }

  // Terminal transitions set ended_reason to match the event (§5).
  if (intent === 'guest_cancel') patch.ended_reason = 'guest_cancelled';

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from('visits').update(patch).eq('id', visit.id);
    if (error) throw error;
  }

  await db.from('visit_events').insert({
    visit_id: visit.id,
    venue_id: visit.venue_id,
    actor: 'guest',
    event: effect.event,
    meta: effect.meta,
  });

  // Return the fresh view (re-read to reflect the applied patch).
  return await respondWithView(db, visit.id);
}

/** How many times the guest has already used „+5 minut" (§5 #12, max 2). */
async function countDelayUses(db: SupabaseClient, visitId: string): Promise<number> {
  const { count, error } = await db
    .from('visit_events')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId)
    .eq('event', 'delay_extended');
  if (error) throw error;
  return count ?? 0;
}

/** New hold deadline = current deadline (or now) + `minutes`. */
function extendHold(current: string | null, minutes: number): string {
  const baseMs = current ? Date.parse(current) : Date.now();
  const from = Number.isNaN(baseMs) ? Date.now() : baseMs;
  return new Date(from + minutes * 60_000).toISOString();
}

// ── set-contact path ───────────────────────────────────────────────────────────

async function handleContact(db: SupabaseClient, raw: unknown): Promise<Response> {
  const parsed = GuestContactInputSchema.safeParse(raw);
  if (!parsed.success) {
    return json(errorBody('invalid_input', parsed.error.message), 400);
  }
  const { token, phone_e164, email, marketing_consent } = parsed.data;

  if (!phone_e164 && !email) {
    return json(errorBody('invalid_input', 'phone or email required'), 400);
  }

  const visit = await loadVisitByToken(db, token);
  if (!visit) return json(errorBody('not_found'), 404);

  // Terminal visits don't accept new contact data (nothing left to notify).
  if (isTerminalStatus(visit.status)) {
    return json(errorBody('invalid_transition', 'visit has ended'), 409);
  }

  const venue = await loadVenue(db, visit.venue_id);
  if (!venue) return json(errorBody('not_found'), 404);

  // Only accept contact when the venue can actually use it (§7.1). Free/SMS-off
  // venues still show a live page but never collect a number.
  if (phone_e164 && !canAddPhone(venue)) {
    return json(errorBody('sms_not_available'), 403);
  }

  const nowIso = new Date().toISOString();
  // marketing_consent_at is a SEPARATE, opt-in basis (§11) — set only when true.
  const marketingAt = marketing_consent ? nowIso : null;

  const guestId = await upsertGuest(db, visit, {
    phone_e164: phone_e164 ?? null,
    email: email ?? null,
    marketing_consent_at: marketingAt,
    retentionDays: venue.settings.retention_days ?? 60,
  });

  if (guestId !== visit.guest_id) {
    const { error } = await db.from('visits').update({ guest_id: guestId }).eq('id', visit.id);
    if (error) throw error;
  }

  return await respondWithView(db, visit.id);
}

// ── push-subscribe path ─────────────────────────────────────────────────────────

/**
 * Store a guest's free web-push subscription against their visit (§7.1 push).
 * No PII, no plan gate, no consent basis needed — it's a transient device token
 * that dies with the visit. Idempotent on (visit_id, endpoint): re-subscribing
 * from the same device refreshes the keys instead of duplicating.
 */
async function handlePushSubscribe(db: SupabaseClient, raw: unknown): Promise<Response> {
  const parsed = PushSubscribeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return json(errorBody('invalid_input', parsed.error.message), 400);
  }
  const { token, subscription } = parsed.data;

  const visit = await loadVisitByToken(db, token);
  if (!visit) return json(errorBody('not_found'), 404);

  // A visit that has ended has nothing left to notify — don't store a target.
  if (isTerminalStatus(visit.status)) {
    return json(errorBody('invalid_transition', 'visit has ended'), 409);
  }

  const { error } = await db
    .from('guest_push_targets')
    .upsert(
      {
        visit_id: visit.id,
        kind: 'webpush',
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        revoked_at: null,
      },
      { onConflict: 'visit_id,endpoint' },
    );
  if (error) throw error;

  return await respondWithView(db, visit.id);
}

interface ContactPatch {
  phone_e164: string | null;
  email: string | null;
  marketing_consent_at: string | null;
  retentionDays: number;
}

/**
 * Upsert the guest row for this visit. If the visit already has a guest we patch
 * it; otherwise we create a venue-scoped guest with a `purge_after` derived from
 * retention (§4, §11). Returns the guest id to link.
 */
async function upsertGuest(
  db: SupabaseClient,
  visit: VisitRow,
  patch: ContactPatch,
): Promise<string> {
  const purgeAfter = purgeAfterDate(patch.retentionDays);

  if (visit.guest_id) {
    const update: Record<string, unknown> = {};
    if (patch.phone_e164) update.phone_e164 = patch.phone_e164;
    if (patch.email) update.email = patch.email;
    // Only ever SET consent (never silently clear an existing one here).
    if (patch.marketing_consent_at) update.marketing_consent_at = patch.marketing_consent_at;
    if (Object.keys(update).length > 0) {
      const { error } = await db.from('guests').update(update).eq('id', visit.guest_id);
      if (error) throw error;
    }
    return visit.guest_id;
  }

  const { data, error } = await db
    .from('guests')
    .insert({
      venue_id: visit.venue_id,
      phone_e164: patch.phone_e164,
      email: patch.email,
      marketing_consent_at: patch.marketing_consent_at,
      purge_after: purgeAfter,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** `today (Warsaw-ish, date only) + retentionDays` as a YYYY-MM-DD date. */
function purgeAfterDate(retentionDays: number): string {
  const d = new Date(Date.now() + retentionDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ── shared response ────────────────────────────────────────────────────────────

async function respondWithView(db: SupabaseClient, visitId: string): Promise<Response> {
  const { data, error } = await db
    .from('visits')
    .select(
      'id, venue_id, guest_id, status, party_size, display_name, public_token, ticket_no, rank, quote_minutes, created_at, notified_at, hold_expires_at, on_way_at, notes',
    )
    .eq('id', visitId)
    .single();
  if (error) throw error;
  const visit = data as VisitRow;

  const venue = await loadVenue(db, visit.venue_id);
  if (!venue) return json(errorBody('not_found'), 404);
  const guest = await loadGuest(db, visit.guest_id);
  const position = await computeVisitPosition(db, visit);
  const view = buildTicketView(visit, venue, guest, position);
  return json(view, 200);
}
