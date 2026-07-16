import { describe, expect, it } from 'vitest';
import type { QuoteDefaults } from './schemas';
import {
  bracket,
  clamp,
  computeQuote,
  elapsedMinutes,
  formatWarsawTime,
  headsUpEta,
  liveWait,
  median,
  roundTo5,
  shouldSendHeadsUp,
  warsawDateKey,
} from './wait-time';

const DEFAULTS: QuoteDefaults = { '1-2': 15, '3-4': 25, '5+': 40 };

describe('bracket (§6)', () => {
  it('maps party size to a bracket', () => {
    expect(bracket(1)).toBe('1-2');
    expect(bracket(2)).toBe('1-2');
    expect(bracket(3)).toBe('3-4');
    expect(bracket(4)).toBe('3-4');
    expect(bracket(5)).toBe('5+');
    expect(bracket(12)).toBe('5+');
  });
});

describe('helpers', () => {
  it('roundTo5 rounds to the nearest 5', () => {
    expect(roundTo5(32.5)).toBe(35);
    expect(roundTo5(12)).toBe(10);
    expect(roundTo5(13)).toBe(15);
  });
  it('clamp bounds a value', () => {
    expect(clamp(3, 5, 90)).toBe(5);
    expect(clamp(200, 5, 90)).toBe(90);
    expect(clamp(42, 5, 90)).toBe(42);
  });
  it('median handles odd/even/empty', () => {
    expect(median([])).toBe(0);
    expect(median([20, 20, 20])).toBe(20);
    expect(median([10, 30])).toBe(20);
    expect(median([5, 1, 9])).toBe(5);
  });
});

describe('computeQuote (§6)', () => {
  it('falls back to venue default with < 3 samples', () => {
    expect(
      computeQuote({ samples: [20, 20], partiesAhead: 2, bracket: '3-4', quoteDefaults: DEFAULTS }),
    ).toBe(25);
  });

  it('adds +10 when the queue is deep (parties ahead ≥ 6) and samples are thin', () => {
    expect(
      computeQuote({ samples: [], partiesAhead: 6, bracket: '3-4', quoteDefaults: DEFAULTS }),
    ).toBe(35);
  });

  it('blends live median 50/50 with the default, rounded to 5', () => {
    // live = median(20)*2 = 40; blended = 0.5*40 + 0.5*25 = 32.5 → 35
    expect(
      computeQuote({
        samples: [20, 20, 20],
        partiesAhead: 2,
        bracket: '3-4',
        quoteDefaults: DEFAULTS,
      }),
    ).toBe(35);
  });

  it('clamps the blended quote to [5, 90]', () => {
    expect(
      computeQuote({
        samples: [200, 200, 200],
        partiesAhead: 5,
        bracket: '5+',
        quoteDefaults: DEFAULTS,
      }),
    ).toBe(90);
  });
});

describe('liveWait (guest live truth §6)', () => {
  it('shows rounded remaining minutes when comfortably ahead', () => {
    expect(liveWait(25, 5)).toEqual({ kind: 'exact', minutes: 20 });
  });
  it('says „już za chwilę" (no number) within 5 minutes', () => {
    expect(liveWait(25, 22)).toEqual({ kind: 'soon', minutes: null });
    expect(liveWait(25, 20)).toEqual({ kind: 'soon', minutes: null }); // remaining exactly 5
  });
  it('never shows a negative/growing number once overdue', () => {
    expect(liveWait(25, 31)).toEqual({ kind: 'overdue', minutes: null }); // remaining -6
    expect(liveWait(25, 30)).toEqual({ kind: 'soon', minutes: null }); // remaining -5 still soft
  });
});

describe('headsUpEta + shouldSendHeadsUp (trigger #3)', () => {
  it('uses median seat interval, falling back to 6 min/position', () => {
    expect(headsUpEta(3, 5)).toBe(15);
    expect(headsUpEta(3, null)).toBe(18);
    expect(headsUpEta(2, 0)).toBe(12);
  });

  it('fires on position OR eta threshold, only when phone + paid + unsent', () => {
    const base = {
      position: 2,
      etaMinutes: 20,
      headsUpPosition: 2,
      headsUpEtaMinutes: 8,
      phonePresent: true,
      headsUpAlreadySent: false,
      paidPlan: true,
    };
    expect(shouldSendHeadsUp(base)).toBe(true); // position ≤ 2
    expect(shouldSendHeadsUp({ ...base, position: 5, etaMinutes: 7 })).toBe(true); // eta ≤ 8
    expect(shouldSendHeadsUp({ ...base, position: 5, etaMinutes: 20 })).toBe(false);
    expect(shouldSendHeadsUp({ ...base, phonePresent: false })).toBe(false);
    expect(shouldSendHeadsUp({ ...base, paidPlan: false })).toBe(false);
    expect(shouldSendHeadsUp({ ...base, headsUpAlreadySent: true })).toBe(false);
  });
});

describe('time math is UTC-safe across DST (§12.3: 2026-03-29 & 2026-10-25)', () => {
  it('elapsedMinutes is unaffected by the spring-forward gap', () => {
    // 00:00Z → 02:00Z spans the 01:00Z spring-forward; real elapsed is still 120 min.
    expect(elapsedMinutes('2026-03-29T00:00:00Z', '2026-03-29T02:00:00Z')).toBe(120);
  });

  it('renders Warsaw wall-clock correctly through the spring-forward', () => {
    expect(formatWarsawTime('2026-03-29T00:30:00Z')).toMatch(/^01.30$/); // 01:30 CET
    expect(formatWarsawTime('2026-03-29T01:30:00Z')).toMatch(/^03.30$/); // jumps to 03:30 CEST
  });

  it('renders both sides of the autumn fall-back as 02:30', () => {
    expect(formatWarsawTime('2026-10-25T00:30:00Z')).toMatch(/^02.30$/); // 02:30 CEST
    expect(formatWarsawTime('2026-10-25T01:30:00Z')).toMatch(/^02.30$/); // 02:30 CET (repeated hour)
  });

  it('warsawDateKey buckets by local calendar day (§4.3 ticket_no)', () => {
    // 23:30Z on the 28th is already 00:30 next day in Warsaw.
    expect(warsawDateKey('2026-03-28T23:30:00Z')).toBe('2026-03-29');
    expect(warsawDateKey('2026-07-16T21:00:00Z')).toBe('2026-07-16');
  });
});
