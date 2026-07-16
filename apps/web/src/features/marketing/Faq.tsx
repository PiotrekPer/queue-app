'use client';

/**
 * Section 8 — FAQ accordion (§10 §8). Real owner questions. Native <details>
 * for zero-JS accessibility + keyboard support; `use client` only so the chevron
 * can react to open state cleanly across the group.
 */
import { useState } from 'react';
import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { Section, SectionHeading } from './Section';

export function Faq({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq">
      <SectionHeading>{c.heading}</SectionHeading>
      <div className="mt-8 flex flex-col divide-y divide-ink/8 rounded-card border border-ink/8 bg-paper-hi">
        {c.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ready-paper"
              >
                <span className="text-body font-semibold text-ink">{item.q}</span>
                <span
                  className={`shrink-0 text-ink-soft transition-transform ${
                    isOpen ? 'rotate-45' : ''
                  }`}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {isOpen ? (
                <p className="px-6 pb-5 text-small leading-relaxed text-ink-soft">{item.a}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
