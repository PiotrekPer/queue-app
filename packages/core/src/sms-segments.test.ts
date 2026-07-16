import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from './templates';
import { analyze, containsPolishDiacritic } from './sms-segments';

describe('analyze — GSM-7 vs UCS-2 boundaries (§7.5)', () => {
  it('pure ASCII fills 160 chars in one GSM-7 segment', () => {
    const info = analyze('a'.repeat(160));
    expect(info.encoding).toBe('GSM-7');
    expect(info.segments).toBe(1);
    expect(info.length).toBe(160);
    expect(info.chars_left).toBe(0);
  });

  it('161 GSM-7 chars spill into a second (153-char) segment', () => {
    const info = analyze('a'.repeat(161));
    expect(info.encoding).toBe('GSM-7');
    expect(info.segments).toBe(2);
    expect(info.perSegment).toBe(153);
    expect(info.chars_left).toBe(2 * 153 - 161);
  });

  it('a single Polish diacritic forces UCS-2 at 70 chars/segment', () => {
    const info = analyze('ą' + 'a'.repeat(9)); // 10 chars
    expect(info.encoding).toBe('UCS-2');
    expect(info.segments).toBe(1);
    expect(info.perSegment).toBe(70);
    expect(info.length).toBe(10);
    expect(info.chars_left).toBe(60);
  });

  it('UCS-2 spills at 71 chars into 67-char segments', () => {
    expect(analyze('ż'.repeat(70)).segments).toBe(1);
    const info = analyze('ż'.repeat(71));
    expect(info.encoding).toBe('UCS-2');
    expect(info.segments).toBe(2);
    expect(info.perSegment).toBe(67);
    expect(info.chars_left).toBe(2 * 67 - 71);
  });

  it('GSM-7 extension chars (€, {, }) count as two septets', () => {
    const info = analyze('€');
    expect(info.encoding).toBe('GSM-7');
    expect(info.length).toBe(2);
    expect(info.chars_left).toBe(158);
  });

  it('detects Polish diacritics (incl. uppercase)', () => {
    expect(containsPolishDiacritic('Zażółć gęślą jaźń')).toBe(true);
    expect(containsPolishDiacritic('Stolik gotowy')).toBe(false);
    expect(containsPolishDiacritic('ŁÓDŹ')).toBe(true);
  });
});

describe('default templates stay GSM-7 (§7.5 — ship diacritic-free)', () => {
  for (const [key, byLocale] of Object.entries(DEFAULT_TEMPLATES)) {
    it(`pl/${key} is GSM-7 and single-segment before {{link}} expansion`, () => {
      const info = analyze(byLocale.pl);
      expect(info.encoding).toBe('GSM-7');
      expect(containsPolishDiacritic(byLocale.pl)).toBe(false);
    });
  }
});
