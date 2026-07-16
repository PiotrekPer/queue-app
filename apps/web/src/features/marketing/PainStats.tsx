import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { Section, SectionHeading } from './Section';

/**
 * Section 2 — the pain in their numbers (§10). Three mono stat cards with
 * honest one-line source captions. Generous whitespace, no icons-for-icons.
 */
export function PainStats({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).pain;

  return (
    <Section id="dlaczego">
      <SectionHeading className="max-w-2xl">{c.heading}</SectionHeading>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {c.stats.map((s) => (
          <div
            key={s.value}
            className="rounded-card border border-ink/8 bg-paper-hi p-6 shadow-sm shadow-ink/5"
          >
            <p className="nums font-mono text-[36px] font-semibold leading-none text-ink">
              {s.value}
            </p>
            <p className="mt-3 text-body text-ink">{s.label}</p>
            <p className="mt-4 text-caption leading-snug text-ink-soft">{s.source}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
