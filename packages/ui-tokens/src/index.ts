/**
 * @stoliq/ui-tokens — the single source of truth for design values.
 *
 * `tokens.json` is law (§9.2). Everything visual in the product derives from it:
 *  - web (Tailwind v4)   → `dist/theme.css` (generated `@theme` block), see `themeCss()`
 *  - staff app (NativeWind) → `tailwind-preset.cjs` (consumes the same JSON)
 *  - React Native inline styles → `darkTheme` / `paperTheme`
 *
 * Rule (§12.1.3): no hex/px literals anywhere else — import from here.
 */
import rawTokens from '../tokens.json';

export interface StatusColor {
  /** value on the dark (staff app) surface */
  dark: string;
  /** value on the paper (guest + landing) surface */
  paper: string;
}

export interface Tokens {
  color: {
    espresso: string;
    walnut: string;
    'walnut-hi': string;
    hairline: string;
    steam: string;
    smoke: string;
    paper: string;
    'paper-hi': string;
    ink: string;
    'ink-soft': string;
    waiting: StatusColor;
    notified: StatusColor;
    ready: StatusColor;
    'ready-fill': string;
    danger: StatusColor;
    'neutral-end': string;
  };
  radius: { card: number; control: number; pill: number; ticket: number };
  /** base grid unit in px; all spacing = space * n (4pt grid) */
  space: number;
  touch: { min: number; primary: number; seatSwipe: number };
  type: {
    display: string;
    ui: string;
    mono: string;
    scale: {
      ticketNo: number;
      position: number;
      h1: number;
      h2: number;
      cardName: number;
      body: number;
      small: number;
      caption: number;
      timer: number;
    };
  };
  motion: { fast: string; emph: string };
}

export const tokens = rawTokens as Tokens;

/** Semantic queue-status keys — the four "indicator lamp" colours plus terminal neutral. */
export type StatusColorKey = 'waiting' | 'notified' | 'ready' | 'danger';

/** 4pt grid helper. `space(4)` → 16 (px). */
export const space = (n: number): number => n * tokens.space;

export const radius = tokens.radius;
export const touch = tokens.touch;
export const type = tokens.type;
export const motion = tokens.motion;

/** Resolved colour set for the staff app (dark, warm "service-bar instrument"). */
export const darkTheme = {
  background: tokens.color.espresso,
  card: tokens.color.walnut,
  cardElevated: tokens.color['walnut-hi'],
  hairline: tokens.color.hairline,
  text: tokens.color.steam,
  textMuted: tokens.color.smoke,
  status: {
    waiting: tokens.color.waiting.dark,
    notified: tokens.color.notified.dark,
    ready: tokens.color.ready.dark,
    readyFill: tokens.color['ready-fill'],
    danger: tokens.color.danger.dark,
    neutral: tokens.color['neutral-end'],
  },
} as const;

/** Resolved colour set for the guest ticket + landing ("the numerek", warm paper). */
export const paperTheme = {
  background: tokens.color.paper,
  card: tokens.color['paper-hi'],
  text: tokens.color.ink,
  textMuted: tokens.color['ink-soft'],
  status: {
    waiting: tokens.color.waiting.paper,
    notified: tokens.color.notified.paper,
    ready: tokens.color.ready.paper,
    readyFill: tokens.color['ready-fill'],
    danger: tokens.color.danger.paper,
    neutral: tokens.color['neutral-end'],
  },
} as const;

/**
 * Colour map shaped for a Tailwind `theme.extend.colors` (used by the NativeWind
 * preset). Nested status objects become `bg-waiting-dark`, `text-notified-paper`, etc.
 */
export const tailwindColors = {
  espresso: tokens.color.espresso,
  walnut: tokens.color.walnut,
  'walnut-hi': tokens.color['walnut-hi'],
  hairline: tokens.color.hairline,
  steam: tokens.color.steam,
  smoke: tokens.color.smoke,
  paper: tokens.color.paper,
  'paper-hi': tokens.color['paper-hi'],
  ink: tokens.color.ink,
  'ink-soft': tokens.color['ink-soft'],
  waiting: tokens.color.waiting,
  notified: tokens.color.notified,
  ready: tokens.color.ready,
  'ready-fill': tokens.color['ready-fill'],
  danger: tokens.color.danger,
  'neutral-end': tokens.color['neutral-end'],
} as const;

/** Font-size scale as a flat px map (Tailwind `fontSize` / RN font sizes). */
export const fontSize = tokens.type.scale;

/** Font-family map keyed by role. */
export const fontFamily = {
  display: tokens.type.display,
  ui: tokens.type.ui,
  mono: tokens.type.mono,
} as const;

/** camelCase → kebab-case (`ticketNo` → `ticket-no`) for CSS custom-prop names. */
function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function flattenColorEntries(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(tokens.color)) {
    if (typeof value === 'string') {
      out.push([key, value]);
    } else {
      out.push([`${key}-dark`, value.dark]);
      out.push([`${key}-paper`, value.paper]);
    }
  }
  return out;
}

/**
 * Generate the Tailwind v4 CSS-first theme block. Written to `dist/theme.css`
 * by `scripts/build-css.ts` and imported by the web app's global stylesheet.
 */
export function themeCss(): string {
  const lines: string[] = ['@theme {'];

  for (const [key, value] of flattenColorEntries()) {
    lines.push(`  --color-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.radius)) {
    lines.push(`  --radius-${key}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(tokens.type.scale)) {
    lines.push(`  --text-${kebab(key)}: ${value}px;`);
  }
  lines.push(`  --font-display: '${tokens.type.display}', sans-serif;`);
  lines.push(`  --font-ui: '${tokens.type.ui}', sans-serif;`);
  lines.push(`  --font-mono: '${tokens.type.mono}', monospace;`);

  lines.push('}');
  return lines.join('\n') + '\n';
}
