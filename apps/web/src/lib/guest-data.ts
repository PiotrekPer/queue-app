/**
 * Guest ticket data layer (§8). Server-side reads go through the `get-ticket`
 * edge function (guests have no direct table access, §4.2). When no backend is
 * configured, we return a DETERMINISTIC MOCK derived from the token so the page
 * renders end-to-end in dev/build/CI.
 *
 * Mutations (guest actions + self-entered contact) are POSTed to our own
 * `/a/[token]` route, which proxies to the `guest-action` edge function.
 */
import { env, hasBackend } from '@/lib/env';
import {
  TicketViewSchema,
  type GuestAction,
  type TicketView,
} from '@stoliq/core';

export type { TicketView };

/** Shape POSTed to `/a/[token]` — either a state action or a contact submission. */
export type GuestActionBody = { kind: 'action'; action: GuestAction };
export type GuestContactBody = {
  kind: 'contact';
  phone_e164: string;
  marketing_consent: boolean;
};

export interface GuestActionResult {
  ok: boolean;
  /** 409 = invalid_transition — caller rolls back the optimistic UI (§8). */
  status: number;
  code?: string;
}

// ─── read ───────────────────────────────────────────────────────────────────

/**
 * Fetch the public ticket view for a token. Returns null for unknown/expired
 * tokens (renders state 6). Server-only: called from the RSC page with no-store
 * so the 8s poll (`router.refresh()`) always sees fresh data.
 */
export async function fetchTicket(token: string): Promise<TicketView | null> {
  // Local dev: read directly via a service-role client (the local edge runtime
  // can't reach @stoliq/core). Dynamic import keeps this server-only module out
  // of the client bundle. In production canUseDirect is false → edge function.
  try {
    const { canUseDirect, getTicketDirect } = await import('./ticket-direct');
    if (canUseDirect) return await getTicketDirect(token);
  } catch (err) {
    console.warn('[guest] direct read unavailable, falling back', err);
  }

  if (!hasBackend) return mockTicket(token);

  try {
    const res = await fetch(
      `${env.functionsUrl}/get-ticket?token=${encodeURIComponent(token)}`,
      { cache: 'no-store', headers: { accept: 'application/json' } },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = TicketViewSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    // Never crash the guest page on a backend hiccup — degrade to "not found".
    return null;
  }
}

// ─── mutations (client → our route → edge fn) ─────────────────────────────────

async function postToActionRoute(
  token: string,
  body: GuestActionBody | GuestContactBody,
): Promise<GuestActionResult> {
  try {
    const res = await fetch(`/a/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    let code: string | undefined;
    try {
      const json: unknown = await res.json();
      if (json && typeof json === 'object' && 'code' in json) {
        code = String((json as { code?: unknown }).code);
      }
    } catch {
      // non-JSON body — ignore
    }
    return { ok: res.ok, status: res.status, code };
  } catch {
    return { ok: false, status: 0, code: 'network_error' };
  }
}

/** Guest taps „Już idziemy" / „+5 minut" / „Rezygnujemy" (§7.3). */
export function postGuestAction(
  token: string,
  action: GuestAction,
): Promise<GuestActionResult> {
  return postToActionRoute(token, { kind: 'action', action });
}

/** Guest self-enters phone (+ optional marketing consent) on the ticket (§8, §11). */
export function submitContact(
  token: string,
  contact: { phone_e164: string; marketing_consent: boolean },
): Promise<GuestActionResult> {
  return postToActionRoute(token, {
    kind: 'contact',
    phone_e164: contact.phone_e164,
    marketing_consent: contact.marketing_consent,
  });
}

// ─── deterministic dev/CI mock ────────────────────────────────────────────────

/** Minutes ago → ISO, so live wait/hold math has plausible inputs. */
function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}
function isoMinutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

const MOCK_BASE = {
  venue_name: 'Trattoria Demo',
  ticket_no: 47,
  party_size: 4,
  display_name: 'Ania · 4 os.',
  quote_minutes: 25,
  has_phone: false,
  can_add_phone: true,
  can_add_wallet: true, // demo: exercise the Add-to-Wallet path without certs
  marketing_enabled: true,
  retention_days: 60,
  locale: 'pl',
} as const;

/**
 * Token → state, so every guest state is reachable without a backend:
 *   demo-waiting  → waiting (position 3, phone opt-in visible)
 *   demo-soon     → waiting but "już za chwilę"
 *   demo-overdue  → waiting but overdue apology
 *   demo-phone    → waiting, phone already on file (no opt-in)
 *   demo-ready / demo-notified → notified (the STOLIK GOTOWY stamp)
 *   demo-onway    → on_way
 *   demo-seated   → seated
 *   demo-cancelled/-noshow/-removed → terminal ended
 *   demo-unknown / anything unmapped → null (state 6, not found)
 * A bare `demo` prefix without a suffix defaults to waiting for convenience.
 */
export function mockTicket(token: string): TicketView | null {
  const t = token.toLowerCase();

  const waiting = (over: Partial<TicketView>): TicketView =>
    TicketViewSchema.parse({
      ...MOCK_BASE,
      status: 'waiting',
      position: 3,
      created_at: isoMinutesAgo(5),
      notified_at: null,
      hold_expires_at: null,
      ...over,
    });

  if (t === 'demo-waiting' || t === 'demo') return waiting({});
  if (t === 'demo-soon')
    // elapsed ≈ quote → liveWait → „już za chwilę"
    return waiting({ position: 1, created_at: isoMinutesAgo(23) });
  if (t === 'demo-overdue')
    // elapsed ≫ quote → overdue apology
    return waiting({ position: 1, created_at: isoMinutesAgo(40) });
  if (t === 'demo-phone')
    return waiting({ has_phone: true });

  if (t === 'demo-ready' || t === 'demo-notified')
    return TicketViewSchema.parse({
      ...MOCK_BASE,
      status: 'notified',
      position: 1,
      has_phone: true,
      created_at: isoMinutesAgo(20),
      notified_at: isoMinutesAgo(1),
      hold_expires_at: isoMinutesFromNow(6),
    });

  if (t === 'demo-onway')
    return TicketViewSchema.parse({
      ...MOCK_BASE,
      status: 'on_way',
      position: 1,
      has_phone: true,
      created_at: isoMinutesAgo(22),
      notified_at: isoMinutesAgo(3),
      hold_expires_at: isoMinutesFromNow(4),
    });

  if (t === 'demo-seated')
    return TicketViewSchema.parse({
      ...MOCK_BASE,
      status: 'seated',
      position: null,
      has_phone: true,
      created_at: isoMinutesAgo(30),
      notified_at: isoMinutesAgo(8),
      hold_expires_at: null,
    });

  const endedMap: Record<string, TicketView['status']> = {
    'demo-cancelled': 'guest_cancelled',
    'demo-noshow': 'no_show',
    'demo-removed': 'staff_removed',
  };
  const ended = endedMap[t];
  if (ended)
    return TicketViewSchema.parse({
      ...MOCK_BASE,
      status: ended,
      position: null,
      created_at: isoMinutesAgo(35),
      notified_at: null,
      hold_expires_at: null,
    });

  // demo-unknown and everything unmapped → not found (state 6).
  return null;
}
