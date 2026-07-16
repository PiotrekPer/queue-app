/**
 * Queue ordering by fractional `rank` (§5.1). New parties get `rank = now` (epoch
 * seconds). "Skip" (§5 #8) drops a party exactly one place by inserting it at the
 * midpoint of the next two ranks — no renumber cascade. Repeated midpoints can
 * exhaust float precision, so we detect that and rebalance to evenly-spaced values.
 */

/** Spacing used when (re)assigning integer ranks. */
export const RANK_STEP = 1000;

/** Smallest meaningful gap between two ranks before we must rebalance. */
export const RANK_EPSILON = 1e-6;

/** Initial rank for a new visit = seconds since epoch (§4). */
export function initialRank(nowMs: number): number {
  return nowMs / 1000;
}

export function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}

/**
 * New rank for a skipped party so it lands exactly one slot lower (§5 #8, golden
 * flow #5). Given the rank of the party immediately behind it (`nextRank`, who
 * moves up) and the one after that (`nextNextRank`, or null if `next` is last):
 *  - two followers → midpoint(next, nextNext)
 *  - one follower  → just past the last party
 */
export function skipRank(nextRank: number, nextNextRank: number | null): number {
  if (nextNextRank === null) return nextRank + RANK_STEP;
  return midpoint(nextRank, nextNextRank);
}

/**
 * 1-based position of `targetRank` among the active queue's ranks (§5.1):
 * `1 + count(rank < targetRank)`. Pass only ranks of active visits.
 */
export function computePosition(targetRank: number, activeRanks: readonly number[]): number {
  let ahead = 0;
  for (const r of activeRanks) {
    if (r < targetRank) ahead += 1;
  }
  return 1 + ahead;
}

/** True when two adjacent ranks are too close to safely bisect again. */
export function needsRebalance(a: number, b: number): boolean {
  return Math.abs(a - b) < RANK_EPSILON;
}

/** True if any adjacent pair in an ordered list has exhausted precision. */
export function anyExhausted(sortedRanks: readonly number[]): boolean {
  for (let i = 1; i < sortedRanks.length; i++) {
    if (needsRebalance(sortedRanks[i - 1] as number, sortedRanks[i] as number)) return true;
  }
  return false;
}

/**
 * Reassign evenly-spaced ranks preserving order. Returns new ranks aligned to the
 * input order (input is assumed already sorted ascending by rank).
 */
export function rebalance(sortedRanks: readonly number[], step: number = RANK_STEP): number[] {
  return sortedRanks.map((_, i) => (i + 1) * step);
}
