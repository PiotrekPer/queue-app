import { describe, expect, it } from 'vitest';
import {
  darkTheme,
  fontSize,
  paperTheme,
  space,
  tailwindColors,
  themeCss,
  tokens,
} from './index';

describe('tokens (hex is law — §9.2)', () => {
  it('pins the warm dark + paper surface colours', () => {
    expect(tokens.color.espresso).toBe('#151210');
    expect(tokens.color.walnut).toBe('#201B18');
    expect(tokens.color.paper).toBe('#F6F1E7');
    expect(tokens.color.ink).toBe('#1A1512');
  });

  it('brand accent = ready green, the colour of good news', () => {
    expect(tokens.color.ready.dark).toBe('#3ECC7E');
    expect(tokens.color.ready.paper).toBe('#177A47');
    expect(tokens.color['ready-fill']).toBe('#1F9D5B');
  });

  it('resolves the four status lamps per surface', () => {
    expect(darkTheme.status.notified).toBe('#E8A23D');
    expect(paperTheme.status.notified).toBe('#9A6A1C');
    expect(darkTheme.status.danger).toBe('#E5484D');
    expect(paperTheme.status.danger).toBe('#B3261E');
  });
});

describe('space (4pt grid)', () => {
  it('multiplies by the base unit', () => {
    expect(space(1)).toBe(4);
    expect(space(4)).toBe(16);
    expect(space(14)).toBe(56); // primary touch target
  });
});

describe('type scale', () => {
  it('exposes the theatrical position + ticket sizes', () => {
    expect(fontSize.position).toBe(96);
    expect(fontSize.ticketNo).toBe(72);
  });
});

describe('themeCss() → Tailwind v4 @theme', () => {
  const css = themeCss();

  it('opens a @theme block', () => {
    expect(css.startsWith('@theme {')).toBe(true);
    expect(css.trimEnd().endsWith('}')).toBe(true);
  });

  it('emits flat colour custom properties, splitting status variants', () => {
    expect(css).toContain('--color-espresso: #151210;');
    expect(css).toContain('--color-waiting-dark: #6AA1E0;');
    expect(css).toContain('--color-waiting-paper: #2F6FBF;');
    expect(css).toContain('--color-ready-fill: #1F9D5B;');
  });

  it('emits radii, kebab-cased text sizes and fonts', () => {
    expect(css).toContain('--radius-card: 16px;');
    expect(css).toContain('--text-position: 96px;');
    expect(css).toContain('--text-ticket-no: 72px;');
    expect(css).toContain("--font-mono: 'IBM Plex Mono', monospace;");
  });
});

describe('tailwindColors (NativeWind preset shape)', () => {
  it('keeps status colours nested and flat colours flat', () => {
    expect(tailwindColors.espresso).toBe('#151210');
    expect(tailwindColors.waiting).toEqual({ dark: '#6AA1E0', paper: '#2F6FBF' });
  });
});
