/**
 * pass-webservice — Apple's PassKit Web Service (docs/specs/push-notifications.md).
 *
 * iOS calls these itself once a pass is added; the guest never sees them. This
 * is what makes a pass *updatable* — without the registration callback we would
 * have no APNs token to wake, and "STOLIK GOTOWY" could never reach the lock
 * screen. Routes are fixed by Apple (relative to `webServiceURL` in pass.json):
 *
 *   POST   /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}  → register
 *   DELETE /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}  → unregister
 *   GET    /v1/devices/{deviceId}/registrations/{passTypeId}           → changed serials
 *   GET    /v1/passes/{passTypeId}/{serial}                            → latest pass
 *   POST   /v1/log                                                     → device logs
 *
 * Auth: `Authorization: ApplePass {authenticationToken}`, where the token is the
 * visit's `public_token` — already the guest's unguessable key (§4.2), so a pass
 * introduces no new secret. We compare it against the serial it claims.
 *
 * Storage: one `guest_push_targets` row per device, kind='apple_wallet',
 *   endpoint      = APNs push token (the address we wake)
 *   wallet_serial = deviceLibraryIdentifier (so DELETE can find it)
 */
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json, preflight } from '../_shared/cors.ts';
import { loadVenue, loadVisitByToken, computeVisitPosition } from '../_shared/ticket.ts';
import { ticketLink } from '../_shared/links.ts';
import { buildSignedPkpass } from '../_shared/apple-wallet.ts';
import type { PassModel } from '@stoliq/core';

/** `Authorization: ApplePass <token>` → the token, or null. */
function passToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^ApplePass\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * The serial IS the visit's public_token, and so is the auth token — a device
 * may only act on the pass it holds.
 */
async function authorizeSerial(req: Request, serial: string) {
  const token = passToken(req);
  if (!token || token !== serial) return null;
  const db = adminClient();
  const visit = await loadVisitByToken(db, serial);
  return visit ? { db, visit } : null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  // Path is matched from the tail so it works under any function mount prefix.
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const v1 = segments.lastIndexOf('v1');
  const route = v1 === -1 ? [] : segments.slice(v1 + 1);

  try {
    // POST /v1/log — device diagnostics. Apple expects a 200; we just breadcrumb.
    if (route[0] === 'log' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      console.warn('[pass-webservice] device log', body);
      return json({ ok: true }, 200);
    }

    // /v1/devices/{deviceId}/registrations/{passTypeId}[/{serial}]
    if (route[0] === 'devices' && route[2] === 'registrations') {
      const deviceId = route[1] ?? '';
      const serial = route[4];

      if (serial && req.method === 'POST') return await register(req, deviceId, serial);
      if (serial && req.method === 'DELETE') return await unregister(req, deviceId, serial);
      if (!serial && req.method === 'GET') return await changedSerials(deviceId);
    }

    // /v1/passes/{passTypeId}/{serial} — hand back the freshest pass.
    if (route[0] === 'passes' && req.method === 'GET') {
      const serial = route[2] ?? '';
      return await latestPass(req, serial);
    }

    return json(errorBody('not_found'), 404);
  } catch (err) {
    console.error('[pass-webservice] error', err);
    return json(errorBody('internal_error'), 500);
  }
});

/** iOS registers a device + its APNs token for a pass it just added. */
async function register(req: Request, deviceId: string, serial: string): Promise<Response> {
  const auth = await authorizeSerial(req, serial);
  if (!auth) return json(errorBody('unauthorized'), 401);

  const body = (await req.json().catch(() => ({}))) as { pushToken?: string };
  const pushToken = body.pushToken?.trim();
  if (!pushToken) return json(errorBody('invalid_input', 'pushToken required'), 400);

  const { error } = await auth.db.from('guest_push_targets').upsert(
    {
      visit_id: auth.visit.id,
      kind: 'apple_wallet',
      endpoint: pushToken,
      wallet_serial: deviceId,
      revoked_at: null,
    },
    { onConflict: 'visit_id,endpoint' },
  );
  if (error) throw error;

  // 201 = newly registered. Apple tolerates 200 for an existing registration;
  // the upsert makes both idempotent, so 201 is the honest default.
  return json({ ok: true }, 201);
}

/** Guest deleted the pass — stop waking this device. */
async function unregister(req: Request, deviceId: string, serial: string): Promise<Response> {
  const auth = await authorizeSerial(req, serial);
  if (!auth) return json(errorBody('unauthorized'), 401);

  const { error } = await auth.db
    .from('guest_push_targets')
    .update({ revoked_at: new Date().toISOString() })
    .eq('visit_id', auth.visit.id)
    .eq('kind', 'apple_wallet')
    .eq('wallet_serial', deviceId);
  if (error) throw error;

  return json({ ok: true }, 200);
}

/**
 * Which of this device's passes changed. We keep one pass per visit and the
 * device only ever holds current ones, so "everything it registered" is right.
 */
async function changedSerials(deviceId: string): Promise<Response> {
  const db = adminClient();
  const { data, error } = await db
    .from('guest_push_targets')
    .select('visit_id, created_at, visits(public_token)')
    .eq('kind', 'apple_wallet')
    .eq('wallet_serial', deviceId)
    .is('revoked_at', null);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ visits: { public_token: string } | null }>;
  const serialNumbers = rows
    .map((r) => r.visits?.public_token)
    .filter((s): s is string => Boolean(s));

  // 204 tells iOS "nothing for this device" — the correct empty answer.
  if (serialNumbers.length === 0) return new Response(null, { status: 204 });

  return json({ lastUpdated: new Date().toISOString(), serialNumbers }, 200);
}

/** The pass as it looks right now — this is the payload of the update. */
async function latestPass(req: Request, serial: string): Promise<Response> {
  const auth = await authorizeSerial(req, serial);
  if (!auth) return json(errorBody('unauthorized'), 401);

  const venue = await loadVenue(auth.db, auth.visit.venue_id);
  if (!venue) return json(errorBody('not_found'), 404);

  const model: PassModel = {
    serial: auth.visit.public_token,
    venueName: venue.name,
    ticketNo: auth.visit.ticket_no,
    status: auth.visit.status,
    position: await computeVisitPosition(auth.db, auth.visit),
    ticketUrl: ticketLink(auth.visit.public_token),
    locale: venue.locale,
  };

  const webServiceUrl =
    Deno.env.get('PASS_WEB_SERVICE_URL') ??
    `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/pass-webservice`;

  const pkpass = await buildSignedPkpass(model, webServiceUrl);
  if (!pkpass) {
    return json(errorBody('not_implemented', 'pkpass signing pending cert'), 501);
  }

  return new Response(pkpass, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.apple.pkpass',
      'last-modified': new Date().toUTCString(),
      'cache-control': 'no-store',
    },
  });
}
