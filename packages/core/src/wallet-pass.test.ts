import { describe, expect, it } from 'vitest';
import { PASS_COLORS, hexToRgbString, presentPass, ticketLabel } from './wallet-pass';
import type { PassModel } from './wallet-pass';
import { VISIT_STATUSES } from './constants';

const base: PassModel = {
  serial: 'abc123',
  venueName: 'Trattoria Demo',
  ticketNo: 47,
  status: 'waiting',
  position: 3,
  ticketUrl: 'https://stq.pl/v/abc123',
  locale: 'pl',
};

describe('presentPass', () => {
  it('shows the position as the headline while waiting', () => {
    const p = presentPass({ ...base, position: 3 });
    expect(p.headline).toBe('3.');
    expect(p.headlineLabel).toBe('w kolejce');
    expect(p.backgroundColor).toBe(PASS_COLORS.paper);
    expect(p.isTerminal).toBe(false);
  });

  it('degrades to a dash when position is unknown', () => {
    expect(presentPass({ ...base, position: null }).headline).toBe('—');
  });

  // §9.2: green means exactly one thing — a table is ready.
  it('turns the whole pass ready-green on notified', () => {
    const p = presentPass({ ...base, status: 'notified', position: null });
    expect(p.headline).toBe('STOLIK GOTOWY');
    expect(p.backgroundColor).toBe(PASS_COLORS.readyFill);
    expect(p.foregroundColor).toBe(PASS_COLORS.paper);
    expect(p.isTerminal).toBe(false);
  });

  it('never paints a waiting pass green', () => {
    expect(presentPass({ ...base, status: 'waiting' }).backgroundColor).not.toBe(
      PASS_COLORS.readyFill,
    );
  });

  it.each(['seated', 'no_show', 'guest_cancelled', 'staff_removed'] as const)(
    'freezes terminal state %s',
    (status) => {
      const p = presentPass({ ...base, status, position: null });
      expect(p.isTerminal).toBe(true);
      expect(p.backgroundColor).toBe(PASS_COLORS.neutralEnd);
    },
  );

  it('localizes to en', () => {
    const p = presentPass({ ...base, status: 'notified', locale: 'en' });
    expect(p.headline).toBe('TABLE READY');
  });

  // Guard the exhaustive switch: a new status must not silently fall through.
  it('returns a presentation for every visit status', () => {
    for (const status of VISIT_STATUSES) {
      const p = presentPass({ ...base, status });
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('ticketLabel', () => {
  it('renders pl and en', () => {
    expect(ticketLabel(base)).toBe('NUMEREK 47');
    expect(ticketLabel({ ...base, locale: 'en' })).toBe('TICKET 47');
  });
});

describe('hexToRgbString', () => {
  // PassKit rejects hex — Apple only accepts rgb() triples.
  it('converts tokens to the rgb() form PassKit requires', () => {
    expect(hexToRgbString('#F6F1E7')).toBe('rgb(246, 241, 231)');
    expect(hexToRgbString('#000000')).toBe('rgb(0, 0, 0)');
    expect(hexToRgbString('#FFFFFF')).toBe('rgb(255, 255, 255)');
  });
});
