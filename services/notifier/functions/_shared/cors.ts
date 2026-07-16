/**
 * CORS headers for the guest-facing edge functions.
 *
 * The guest ticket page (`apps/web/(guest)/v/[token]`) and its action endpoints
 * call `get-ticket` and `guest-action` from the browser, so those must answer
 * preflight `OPTIONS`. The server-only functions (`send-notification`,
 * `sweep-timers`, `purge-guests`) are invoked by pg_cron / service contexts and
 * do not need CORS, but sharing one header set keeps things simple.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

/** JSON response with CORS + no-store (guest routes stay tracker/cache-free, §8). */
export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

/** Standard preflight answer. Returns null when the request is not a preflight. */
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

/** Shape of an error body returned to callers. */
export function errorBody(code: string, message?: string): { error: string; message?: string } {
  return message ? { error: code, message } : { error: code };
}
