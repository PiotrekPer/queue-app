import Link from 'next/link';
import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { localeHref } from './locale';
import { Section, SectionHeading } from './Section';

/**
 * Section 5 — Cennik (§10). Flat, honest, anti-commission. Three paper cards;
 * Pro is „najczęściej wybierany" with a ready-green border. Reused on the
 * landing and on /cennik. `heading={false}` hides the section heading when the
 * page provides its own hero above.
 */
export function Pricing({
  locale,
  heading = true,
}: {
  locale: Locale;
  heading?: boolean;
}) {
  const c = marketingCopy(locale).pricing;

  return (
    <Section id="cennik">
      {heading ? (
        <SectionHeading className="max-w-2xl">
          {c.heading}
          <span className="mt-2 block text-body font-normal text-ink-soft">{c.sub}</span>
        </SectionHeading>
      ) : null}

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {c.plans.map((plan) => {
          const featured = plan.featured === true;
          const soon = plan.soon === true;
          const free = plan.free === true;
          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-card bg-paper-hi p-7 shadow-sm shadow-ink/5 ${
                featured
                  ? 'border-2 border-ready-paper shadow-md'
                  : 'border border-ink/8'
              }`}
            >
              {featured ? (
                <span className="absolute -top-3 left-7 rounded-pill bg-ready-fill px-3 py-1 text-caption font-semibold text-paper-hi">
                  {c.mostPopular}
                </span>
              ) : null}

              <div className="flex items-baseline justify-between">
                <h3 className="text-card-name font-semibold text-ink">{plan.name}</h3>
                {soon ? (
                  <span className="rounded-pill bg-ink/5 px-2.5 py-0.5 text-caption text-ink-soft">
                    {c.soon}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-small text-ink-soft">{plan.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="nums font-mono text-[40px] font-semibold leading-none text-ink">
                  {plan.price}
                </span>
                {free ? null : (
                  <span className="text-small text-ink-soft">{c.perMonth}</span>
                )}
              </p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-small text-ink">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ready-paper"
                      aria-hidden
                    />
                    <span className="text-ink-soft">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={localeHref('/kontakt', locale)}
                aria-disabled={soon}
                className={`mt-7 inline-flex h-12 items-center justify-center rounded-pill text-body font-semibold transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  soon
                    ? 'pointer-events-none bg-ink/5 text-ink-soft'
                    : featured
                      ? 'bg-ready-fill text-paper-hi hover:scale-[1.02]'
                      : 'border border-ink/15 text-ink hover:bg-ink/5'
                }`}
              >
                {soon ? c.soon : free ? c.ctaFree : c.ctaPaid}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-small text-ink-soft">{c.footnote}</p>
    </Section>
  );
}
