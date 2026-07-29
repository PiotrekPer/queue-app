/**
 * issue-pass — hand the guest a wallet pass for their numerek
 * (docs/specs/push-notifications.md, Phase B).
 *
 * `GET ?token={public_token}&platform=apple|google`
 *   apple  → 200 application/vnd.apple.pkpass (the signed archive; iOS opens it)
 *   google → 200 { saveUrl } (the client opens pay.google.com/gp/v/save/{jwt})
 *
 * Guest-facing and unauthenticated by design: the `public_token` IS the
 * credential (§4.2), same as the ticket page. Rate-limited like the other guest
 * endpoints (30/min per token, 120/min per IP).
 *
 * Apple registers the device with us AFTER adding (see `pass-webservice`), so
 * there is nothing to store here. Google has no device registration, so we
 * record the target at issue time.
 */
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json, preflight } from '../_shared/cors.ts';
import { checkGuestRate, clientIp, rateLimitHeaders } from '../_shared/ratelimit.ts';
import { loadVenue, loadVisitByToken, computeVisitPosition } from '../_shared/ticket.ts';
import { ticketLink } from '../_shared/links.ts';
import { isTerminalStatus } from '@stoliq/core';
import {
  appleWalletConfigured,
  buildSignedPkpass,
} from '../_shared/apple-wallet.ts';
import {
  buildSaveJwt,
  googleWalletConfigured,
  passObjectId,
} from '../_shared/google-wallet.ts';
import type { PassModel } from '@stoliq/core';

/** Where iOS calls back to register/refresh the pass (Apple requires https). */
function passWebServiceUrl(): string {
  const base = Deno.env.get('PASS_WEB_SERVICE_URL');
  if (base) return base;
  const fnBase = Deno.env.get('SUPABASE_URL') ?? '';
  return `${fnBase}/functions/v1/pass-webservice`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'GET') {
    return json(errorBody('method_not_allowed'), 405);
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  const platform = (url.searchParams.get('platform') ?? '').trim();

  if (!token) return json(errorBody('missing_token'), 400);
  if (platform !== 'apple' && platform !== 'google') {
    return json(errorBody('invalid_input', 'platform must be apple|google'), 400);
  }

  const rate = checkGuestRate(token, clientIp(req));
  if (!rate.ok) {
    return json(errorBody('rate_limited'), 429, rateLimitHeaders(rate));
  }

  try {
    const db = adminClient();

    const visit = await loadVisitByToken(db, token);
    if (!visit) return json(errorBody('not_found'), 404);
    // A finished visit has nothing to carry in a wallet.
    if (isTerminalStatus(visit.status)) {
      return json(errorBody('invalid_transition', 'visit has ended'), 409);
    }

    const venue = await loadVenue(db, visit.venue_id);
    if (!venue) return json(errorBody('not_found'), 404);

    const model: PassModel = {
      serial: visit.public_token,
      venueName: venue.name,
      ticketNo: visit.ticket_no,
      status: visit.status,
      position: await computeVisitPosition(db, visit),
      ticketUrl: ticketLink(visit.public_token),
      locale: venue.locale,
    };

    return platform === 'apple'
      ? await issueApple(model)
      : await issueGoogle(db, visit.id, model);
  } catch (err) {
    console.error('[issue-pass] error', err);
    return json(errorBody('internal_error'), 500);
  }
});

/** Signed .pkpass bytes — iOS presents the "Add to Wallet" sheet. */
async function issueApple(model: PassModel): Promise<Response> {
  if (!appleWalletConfigured()) {
    return json(errorBody('not_configured', 'apple wallet credentials missing'), 501);
  }

  const pkpass = await buildSignedPkpass(model, passWebServiceUrl());
  if (!pkpass) {
    return json(errorBody('not_implemented', 'pkpass signing pending cert'), 501);
  }

  return new Response(pkpass, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.apple.pkpass',
      // inline so a direct hit (bypassing the web proxy) still hands off to PassKit.
      'content-disposition': `inline; filename="numerek-${model.ticketNo}.pkpass"`,
      'cache-control': 'no-store',
    },
  });
}

/**
 * A save URL for Google Wallet. Unlike Apple there is no device callback, so we
 * record the target now — the pass object id is all a later PATCH needs.
 */
async function issueGoogle(
  db: ReturnType<typeof adminClient>,
  visitId: string,
  model: PassModel,
): Promise<Response> {
  if (!googleWalletConfigured()) {
    return json(errorBody('not_configured', 'google wallet credentials missing'), 501);
  }

  // buildSaveJwt returns the complete pay.google.com/gp/v/save/<jwt> URL (same
  // contract as the web twin google-pass.ts) — hand it back as-is.
  const saveUrl = await buildSaveJwt(model);
  if (!saveUrl) {
    return json(errorBody('not_implemented', 'save jwt signing pending key'), 501);
  }

  // Idempotent on (visit_id, wallet_serial): re-tapping "Dodaj do Google Wallet"
  // re-activates the same target rather than duplicating. Arbiter = the NON-partial
  // unique index from migration 0009 (a partial index can't serve as a PostgREST
  // onConflict arbiter). webpush rows keep wallet_serial null and, NULLs being
  // distinct, never collide here.
  const { error } = await db.from('guest_push_targets').upsert(
    {
      visit_id: visitId,
      kind: 'google_wallet',
      wallet_serial: passObjectId(model.serial),
      revoked_at: null,
    },
    { onConflict: 'visit_id,wallet_serial' },
  );
  if (error) throw error;

  return json({ saveUrl }, 200);
}
