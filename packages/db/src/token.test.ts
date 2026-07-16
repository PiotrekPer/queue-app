import { describe, expect, it } from 'vitest';
import { BASE58_ALPHABET, PUBLIC_TOKEN_LENGTH, generatePublicToken } from './token';

/** Mulberry32 — a tiny deterministic PRNG for reproducible test draws. */
function seededRand(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE58_SET = new Set(BASE58_ALPHABET.split(''));
const AMBIGUOUS = ['0', 'O', 'I', 'l'];

describe('generatePublicToken', () => {
  it('is exactly PUBLIC_TOKEN_LENGTH (16) chars', () => {
    expect(PUBLIC_TOKEN_LENGTH).toBe(16);
    expect(generatePublicToken(seededRand(1))).toHaveLength(16);
  });

  it('uses only base58 characters', () => {
    const token = generatePublicToken(seededRand(99));
    for (const ch of token) {
      expect(BASE58_SET.has(ch)).toBe(true);
    }
  });

  it('never contains the visually ambiguous glyphs 0 O I l', () => {
    // Draw many tokens to make an accidental ambiguous char statistically certain.
    const rand = seededRand(7);
    const joined = Array.from({ length: 500 }, () => generatePublicToken(rand)).join('');
    for (const bad of AMBIGUOUS) {
      expect(joined.includes(bad)).toBe(false);
    }
  });

  it('is deterministic given the same seeded rand', () => {
    expect(generatePublicToken(seededRand(42))).toBe(generatePublicToken(seededRand(42)));
  });

  it('produces different tokens from different seeds', () => {
    expect(generatePublicToken(seededRand(1))).not.toBe(generatePublicToken(seededRand(2)));
  });

  it('clamps a degenerate rand() === 1 to a valid last-alphabet index', () => {
    const token = generatePublicToken(() => 1);
    const last = BASE58_ALPHABET[BASE58_ALPHABET.length - 1];
    expect(token).toBe(last!.repeat(PUBLIC_TOKEN_LENGTH));
    expect(token).toHaveLength(PUBLIC_TOKEN_LENGTH);
  });

  it('has high uniqueness across 1000 draws', () => {
    const rand = seededRand(12345);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      seen.add(generatePublicToken(rand));
    }
    // 58^16 space → collisions in 1000 draws are astronomically unlikely.
    expect(seen.size).toBe(1000);
  });
});
