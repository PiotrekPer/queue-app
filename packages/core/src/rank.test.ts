import { describe, expect, it } from 'vitest';
import {
  anyExhausted,
  computePosition,
  initialRank,
  midpoint,
  needsRebalance,
  rebalance,
  skipRank,
} from './rank';

describe('rank basics (§5.1)', () => {
  it('initialRank is epoch seconds', () => {
    expect(initialRank(1_000)).toBe(1);
    expect(initialRank(47_000)).toBe(47);
  });
  it('midpoint bisects', () => {
    expect(midpoint(2000, 3000)).toBe(2500);
  });
});

describe('skip drops exactly one place (golden flow #5)', () => {
  it('4-party queue: skip #1 → order becomes 2,1,3,4', () => {
    const B = 2000;
    const C = 3000;
    const D = 4000;
    // Skip A: it lands at the midpoint of the next two (B, C).
    const newA = skipRank(B, C);
    expect(newA).toBe(2500);

    const ordered = [
      { label: 'B', rank: B },
      { label: 'A', rank: newA },
      { label: 'C', rank: C },
      { label: 'D', rank: D },
    ]
      .sort((x, y) => x.rank - y.rank)
      .map((v) => v.label);
    expect(ordered).toEqual(['B', 'A', 'C', 'D']);
  });

  it('skipping the second-to-last party sends it to the end', () => {
    expect(skipRank(4000, null)).toBeGreaterThan(4000);
  });
});

describe('computePosition (§5.1)', () => {
  it('is 1 + count(rank < target) among active ranks', () => {
    expect(computePosition(2500, [2000, 3000, 4000])).toBe(2);
    expect(computePosition(1000, [2000, 3000])).toBe(1);
    expect(computePosition(9999, [2000, 3000, 4000])).toBe(4);
  });
});

describe('float exhaustion → rebalance', () => {
  it('detects adjacent ranks too close to bisect', () => {
    expect(needsRebalance(1, 1 + 1e-9)).toBe(true);
    expect(needsRebalance(1000, 2000)).toBe(false);
  });

  it('flags an exhausted ordered list and rebalances to even spacing', () => {
    // Repeated midpoints between 1 and 2 eventually collapse precision.
    const lo = 1;
    let hi = 2;
    for (let i = 0; i < 60; i++) hi = midpoint(lo, hi);
    expect(needsRebalance(lo, hi)).toBe(true);

    expect(anyExhausted([1, 1, 2])).toBe(true);
    expect(rebalance([5, 5, 5])).toEqual([1000, 2000, 3000]);
  });
});
