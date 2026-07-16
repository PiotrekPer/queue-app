import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { Section } from './Section';

/**
 * Section 7 — Case study slot (§10). Built now, filled after pilots. Until real
 * data exists we render an HONEST placeholder — never fake logos/testimonials.
 */
export function CaseStudy({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).caseStudy;

  return (
    <Section id="historie">
      <div className="rounded-card border border-dashed border-ink/15 bg-paper-hi/60 p-10 text-center">
        <p className="font-mono text-caption uppercase tracking-[0.12em] text-ink-soft">
          {c.kicker}
        </p>
        <p className="mt-4 font-display text-h2 font-bold text-ink">{c.placeholder}</p>
        <p className="mx-auto mt-3 max-w-md text-small leading-relaxed text-ink-soft">{c.sub}</p>
      </div>
    </Section>
  );
}
