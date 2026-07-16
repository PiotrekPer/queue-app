import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATES,
  defaultTemplate,
  renderTemplate,
  templatePlaceholders,
} from './templates';

describe('renderTemplate', () => {
  it('substitutes {{placeholders}} and stringifies numbers', () => {
    const out = renderTemplate('{{venue}}: nr {{ticket_no}} {{link}}', {
      venue: 'Trattoria Demo',
      ticket_no: 47,
      link: 'stq.pl/v/abc',
    });
    expect(out).toBe('Trattoria Demo: nr 47 stq.pl/v/abc');
  });

  it('drops unknown placeholders to empty string', () => {
    expect(renderTemplate('hi {{name}}!', {})).toBe('hi !');
  });

  it('lists referenced placeholders', () => {
    expect(templatePlaceholders(DEFAULT_TEMPLATES.table_ready.pl).sort()).toEqual([
      'hold',
      'link',
      'venue',
    ]);
  });
});

describe('default templates (§7.2)', () => {
  it('exposes pl + en for every key', () => {
    for (const key of ['joined', 'heads_up', 'table_ready', 'renotify'] as const) {
      expect(defaultTemplate(key, 'pl').length).toBeGreaterThan(0);
      expect(defaultTemplate(key, 'en').length).toBeGreaterThan(0);
    }
  });

  it('renders table_ready end to end', () => {
    const body = renderTemplate(defaultTemplate('table_ready', 'pl'), {
      venue: 'Trattoria Demo',
      hold: 7,
      link: 'stq.pl/v/xyz',
    });
    expect(body).toContain('Trattoria Demo');
    expect(body).toContain('7 min');
    expect(body).not.toContain('{{');
  });
});
