/**
 * get-ticket (§8, §4.2) — the guest ticket page's read endpoint.
 *
 * GET ?token=…  → look up the visit by `public_token` (service role, RLS-bypass),
 * compute live position, and return a sanitized `TicketView`. No login, no
 * cookies, no PII beyond `display_name`. Rate-limited 30/min per token, 120/min
 * per IP. The page polls this every 8s + on visibilitychange.
 */
import {
  buildTicketView,
  computeVisitPosition,
  loadGuest,
  loadVenue,
  loadVisitByToken,
} from '../_shared/ticket.ts';
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json, preflight } from '../_shared/cors.ts';
import { checkGuestRate, clientIp, rateLimitHeaders } from '../_shared/ratelimit.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'GET') {
    return json(errorBody('method_not_allowed'), 405);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) {
    return json(errorBody('missing_token'), 400);
  }

  // Rate limit before touching the DB (§4.2).
  const rate = checkGuestRate(token, clientIp(req));
  if (!rate.ok) {
    return json(errorBody('rate_limited'), 429, rateLimitHeaders(rate));
  }

  try {
    const db = adminClient();
    const visit = await loadVisitByToken(db, token);
    if (!visit) {
      // Unknown/expired token → 404 ticket state (§8 state 6).
      return json(errorBody('not_found'), 404);
    }

    const venue = await loadVenue(db, visit.venue_id);
    if (!venue) {
      return json(errorBody('not_found'), 404);
    }

    const guest = await loadGuest(db, visit.guest_id);
    const position = await computeVisitPosition(db, visit);
    const view = buildTicketView(visit, venue, guest, position);

    return json(view, 200);
  } catch (err) {
    console.error('[get-ticket] error', err);
    return json(errorBody('internal_error'), 500);
  }
});
