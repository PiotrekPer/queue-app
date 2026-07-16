/**
 * Small pure helpers for the Add flow + QR screen.
 * The quote math lives in @stoliq/core (§6) — we only orchestrate it here.
 */
import { bracket, computeQuote, DEFAULT_SETTINGS, LIMITS } from '@stoliq/core';

/**
 * Demo venue used when the app runs without a backend. The queue store owns the
 * real venue context in a live build; the add flow only needs a valid venue_id
 * to construct a CreateVisitInput. Fixed UUID → deterministic demo data.
 */
export const DEMO_VENUE_ID = '00000000-0000-4000-8000-000000000047';

/** Short guest link shown as the QR value (§7.2: stq.pl/v/{token}). */
export const GUEST_BASE_URL = 'stq.pl/v/';

export function guestTicketUrl(publicToken: string): string {
  return `${GUEST_BASE_URL}${publicToken}`;
}

/**
 * Add-time auto quote for a party size (§6). No live seat samples in the client,
 * so this is the venue-default path (+10 when the queue is deep); the server
 * recomputes with real throughput when a backend is present.
 */
export function autoQuoteForSize(partySize: number, partiesAhead: number): number {
  return computeQuote({
    samples: [],
    partiesAhead,
    bracket: bracket(partySize),
    quoteDefaults: DEFAULT_SETTINGS.quote_defaults,
  });
}

/** Nudge a quote by ±5 (staff override on the QR screen), clamped to [5, 90] (§6). */
export function adjustQuote(current: number, deltaSteps: number): number {
  const next = current + deltaSteps * 5;
  return Math.min(LIMITS.maxQuoteMinutes, Math.max(LIMITS.minQuoteMinutes, next));
}
