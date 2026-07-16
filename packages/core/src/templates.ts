/**
 * Default SMS templates (§7.2) + a tiny {{placeholder}} renderer.
 * PL bodies are deliberately diacritic-free so they stay GSM-7 (§7.5).
 * These seed `message_templates`; venues may edit them (Settings, §9.3D).
 */
import type { Locale, TemplateKey } from './constants';

export type TemplateVars = Record<string, string | number>;

export const DEFAULT_TEMPLATES: Record<TemplateKey, Record<Locale, string>> = {
  joined: {
    pl: 'Czesc {{name}}! Jestes w kolejce w {{venue}} (nr {{ticket_no}}). Sledz na zywo: {{link}}',
    en: 'Hi {{name}}! You are in the queue at {{venue}} (no. {{ticket_no}}). Track live: {{link}}',
  },
  heads_up: {
    pl: '{{venue}}: juz prawie! Twoj stolik bedzie gotowy za chwile. Wracaj powoli :) {{link}}',
    en: '{{venue}}: almost there! Your table will be ready any minute. Head back slowly :) {{link}}',
  },
  table_ready: {
    pl: '{{venue}}: Twoj stolik jest gotowy! Mamy go dla Ciebie przez {{hold}} min. {{link}}',
    en: '{{venue}}: your table is ready! We are holding it for {{hold}} min. {{link}}',
  },
  renotify: {
    pl: '{{venue}}: przypominamy - stolik czeka. Dasz znac? {{link}}',
    en: '{{venue}}: a reminder - your table is waiting. Let us know? {{link}}',
  },
};

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** Replace {{placeholders}} with `vars`; unknown placeholders become ''. */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key];
    return value === undefined ? '' : String(value);
  });
}

/** List the placeholder names referenced by a template body. */
export function templatePlaceholders(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return [...names];
}

export function defaultTemplate(key: TemplateKey, locale: Locale): string {
  return DEFAULT_TEMPLATES[key][locale];
}
