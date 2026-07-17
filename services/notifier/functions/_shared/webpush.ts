/**
 * Web Push sender (docs/specs/push-notifications.md, Phase A). Free channel: no
 * plan gate, no wallet debit. Mirrors smsapi.ts / resend.ts as the transport for
 * the `push` branch of the §7.4 job pipeline.
 *
 * Delivery uses VAPID (`npm:web-push`). A visit may have several active targets
 * (multiple devices); we fan out to all of them and prune the ones the browser
 * push service reports as gone (404/410) by marking `revoked_at`.
 */
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

/** A stored web-push subscription for one device (guest_push_targets). */
export interface PushTarget {
  id: string;
  kind: 'webpush' | 'apple_wallet' | 'google_wallet';
  endpoint: string | null;
  keys: { p256dh?: string; auth?: string } | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface SendPushResult {
  ok: boolean;
  /** how many active targets accepted the push */
  sent: number;
  /** how many targets were expired and got revoked */
  pruned: number;
  error: string | null;
}

let vapidReady = false;

/** Configure VAPID once per instance from env (subject must be a mailto:/https URL). */
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:kontakt@stq.pl';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

/** Active (non-revoked) web-push targets for a visit. */
export async function loadPushTargets(
  db: SupabaseClient,
  visitId: string,
): Promise<PushTarget[]> {
  const { data, error } = await db
    .from('guest_push_targets')
    .select('id, kind, endpoint, keys')
    .eq('visit_id', visitId)
    .eq('kind', 'webpush')
    .is('revoked_at', null);
  if (error) throw error;
  return (data ?? []) as PushTarget[];
}

/** Mark a dead subscription revoked so we stop trying it (browser said 404/410). */
async function revokeTarget(db: SupabaseClient, id: string): Promise<void> {
  await db
    .from('guest_push_targets')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
}

/**
 * Fan a payload out to every active web-push target of a visit. Best-effort:
 * `ok` is true if at least one target accepted (or if there were simply no
 * targets — a guest who never opted in is not a failure, just page-only).
 */
export async function sendPushForVisit(
  db: SupabaseClient,
  visitId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  if (!ensureVapid()) {
    return { ok: false, sent: 0, pruned: 0, error: 'vapid_not_configured' };
  }

  const targets = await loadPushTargets(db, visitId);
  if (targets.length === 0) {
    // No opt-in on this visit — not an error, nothing to send.
    return { ok: true, sent: 0, pruned: 0, error: null };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;
  let lastError: string | null = null;

  for (const t of targets) {
    if (!t.endpoint || !t.keys?.p256dh || !t.keys?.auth) continue;
    const subscription = {
      endpoint: t.endpoint,
      keys: { p256dh: t.keys.p256dh, auth: t.keys.auth },
    };
    try {
      await webpush.sendNotification(subscription, body);
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await revokeTarget(db, t.id);
        pruned += 1;
      } else {
        lastError = err instanceof Error ? err.message : 'push_error';
      }
    }
  }

  return { ok: sent > 0, sent, pruned, error: sent > 0 ? null : lastError };
}
