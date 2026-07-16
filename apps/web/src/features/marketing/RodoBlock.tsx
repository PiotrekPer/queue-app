import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { Section, SectionHeading } from './Section';

/**
 * Section 6 — RODO trust block (§10/§11). Short, factual: EU (Frankfurt),
 * auto-deletion 30/60/90, processing agreement included, guest enters own
 * number. Closes Polish owners' #1 objection. Reused on /rodo.
 */
export function RodoBlock({
  locale,
  heading = true,
}: {
  locale: Locale;
  heading?: boolean;
}) {
  const c = marketingCopy(locale).rodo;

  return (
    <Section id="rodo">
      {heading ? (
        <SectionHeading kicker={c.kicker} className="max-w-2xl">
          {c.heading}
        </SectionHeading>
      ) : null}

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {c.points.map((p) => (
          <div
            key={p.title}
            className="rounded-card border border-ink/8 bg-paper-hi p-6 shadow-sm shadow-ink/5"
          >
            <h3 className="text-card-name font-semibold text-ink">{p.title}</h3>
            <p className="mt-2 text-small leading-relaxed text-ink-soft">{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
