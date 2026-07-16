/**
 * In-memory sliding-window rate limiter for the guest endpoints (§4.2).
 *
 * Limits: 30 req/min per public_token, 120 req/min per client IP. Because edge
 * function instances are ephemeral and per-region, this is a best-effort first
 * line of defence (a single warm instance absorbs bursts); durable limiting
 * belongs at the gateway. It is intentionally dependency-free so it works in the
 * Deno isolate without extra imports.
 *
 * Sliding window: we keep the hit timestamps within the last `windowMs` and
 * count them. Old timestamps are pruned lazily on each check.
 */

export const WINDOW_MS = 60_000;
export const PER_TOKEN_LIMIT = 30;
export const PER_IP_LIMIT = 120;

interface Bucket {
  hits: number[]; // epoch-ms timestamps, ascending
}

const buckets = new Map<string, Bucket>();

/** Result of a limit check. `retryAfterSeconds` is set only when limited. */
export interface RateResult {
  ok: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

function hitBucket(key: string, limit: number, now: number): RateResult {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  const cutoff = now - WINDOW_MS;
  // Prune expired hits from the front (ascending order).
  let firstFresh = 0;
  while (firstFresh < bucket.hits.length && (bucket.hits[firstFresh] as number) <= cutoff) {
    firstFresh += 1;
  }
  if (firstFresh > 0) bucket.hits.splice(0, firstFresh);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] as number;
    const retryAfterMs = Math.max(0, oldest + WINDOW_MS - now);
    return {
      ok: false,
      remaining: 0,
      limit,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  bucket.hits.push(now);
  return {
    ok: true,
    remaining: limit - bucket.hits.length,
    limit,
    retryAfterSeconds: 0,
  };
}

/**
 * Check both the per-token and per-IP windows and record a hit against each.
 * Returns the first failing result, or an ok result. When either is exhausted
 * the caller should respond 429 with `Retry-After`.
 */
export function checkGuestRate(token: string, ip: string, now: number = Date.now()): RateResult {
  // IP first (the coarser, cheaper-to-hit bound), then token.
  const ipKey = `ip:${ip}`;
  const tokenKey = `tok:${token}`;

  const ipResult = hitBucket(ipKey, PER_IP_LIMIT, now);
  if (!ipResult.ok) return ipResult;

  const tokenResult = hitBucket(tokenKey, PER_TOKEN_LIMIT, now);
  return tokenResult;
}

/** Best-effort client IP from proxy headers (Supabase/Cloudflare forward these). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // First hop is the original client.
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/** Headers to attach to a 429 response. */
export function rateLimitHeaders(result: RateResult): Record<string, string> {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
  };
}

/** Test/maintenance hook: clear all buckets (not used in production paths). */
export function _resetRateLimiter(): void {
  buckets.clear();
}
