/**
 * Wait-time logic v1 (§6). Deliberately humble: position is the truth, minutes
 * are rounded, and we never show a live countdown or a growing negative number.
 *
 * Time math is done on absolute UTC instants, so DST transitions
 * (2026-03-29, 2026-10-25 Europe/Warsaw) never distort an elapsed duration.
 * Only *rendering* a wall-clock (`formatWarsawTime`) is timezone-aware.
 */
import { BRACKETS, LIMITS, VENUE_TIMEZONE, type Bracket } from './constants';
import type { QuoteDefaults } from './schemas';

/** Party-size → bracket (§6). */
export function bracket(size: number): Bracket {
  if (size <= 2) return '1-2';
  if (size <= 4) return '3-4';
  return '5+';
}

export function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Median of a numeric sample (0 for empty). */
export function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export interface QuoteArgs {
  /** seat-interval samples in minutes for this bracket, trailing window (§6) */
  samples: readonly number[];
  /** parties ahead of the same-or-smaller bracket */
  partiesAhead: number;
  bracket: Bracket;
  quoteDefaults: QuoteDefaults;
}

/**
 * The add-time quote (§6). With < 3 samples we fall back to the venue default
 * (+10 when the queue is deep). Otherwise we blend live median throughput 50/50
 * with the default, then round-to-5 and clamp to [5, 90].
 */
export function computeQuote(args: QuoteArgs): number {
  const fallback = args.quoteDefaults[args.bracket];

  if (args.samples.length < LIMITS.minSeatSamples) {
    const deep = args.partiesAhead >= 6 ? 10 : 0;
    return clamp(fallback + deep, LIMITS.minQuoteMinutes, LIMITS.maxQuoteMinutes);
  }

  const live = median(args.samples) * args.partiesAhead;
  const blended = live * 0.5 + fallback * 0.5;
  return clamp(roundTo5(blended), LIMITS.minQuoteMinutes, LIMITS.maxQuoteMinutes);
}

export type WaitKind = 'exact' | 'soon' | 'overdue';

export interface LiveWait {
  kind: WaitKind;
  /** rounded remaining minutes; null for soon/overdue (we don't show a number) */
  minutes: number | null;
}

/**
 * Guest-facing live wait (§6). `≤ 5 min` → „już za chwilę" (no number);
 * `< -5 min` → overdue apology (never a negative/growing number); otherwise
 * remaining minutes rounded to 5.
 */
export function liveWait(quoteMinutes: number, elapsedMinutes: number): LiveWait {
  const remaining = quoteMinutes - elapsedMinutes;
  if (remaining < -5) return { kind: 'overdue', minutes: null };
  if (remaining <= 5) return { kind: 'soon', minutes: null };
  return { kind: 'exact', minutes: roundTo5(remaining) };
}

/**
 * Heads-up ETA used by trigger #3 = position × median seat interval, with a
 * fallback of 6 min/position when there is no live median (§6).
 */
export function headsUpEta(position: number, medianSeatInterval: number | null): number {
  const per =
    medianSeatInterval && medianSeatInterval > 0
      ? medianSeatInterval
      : LIMITS.headsUpFallbackMinutesPerPosition;
  return position * per;
}

export interface HeadsUpArgs {
  position: number;
  etaMinutes: number;
  headsUpPosition: number;
  headsUpEtaMinutes: number;
  phonePresent: boolean;
  headsUpAlreadySent: boolean;
  paidPlan: boolean;
}

/** Trigger #3 eligibility (§5): position OR ETA threshold, phone, unsent, paid. */
export function shouldSendHeadsUp(a: HeadsUpArgs): boolean {
  if (!a.phonePresent || a.headsUpAlreadySent || !a.paidPlan) return false;
  return a.position <= a.headsUpPosition || a.etaMinutes <= a.headsUpEtaMinutes;
}

// ─── time helpers (UTC math, Warsaw rendering) ──────────────────────────────

/** Whole-minute elapsed between two ISO instants (UTC-safe, DST-proof). */
export function elapsedMinutes(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return Math.floor((to - from) / 60000);
}

/** Render an ISO instant as Europe/Warsaw wall clock „HH:MM" (DST-aware). */
export function formatWarsawTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENUE_TIMEZONE,
  }).format(new Date(iso));
}

/** Local Europe/Warsaw calendar date „YYYY-MM-DD" for ticket_no bucketing (§4.3). */
export function warsawDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: VENUE_TIMEZONE,
  }).format(new Date(iso));
  return parts;
}

export const ALL_BRACKETS = BRACKETS;
