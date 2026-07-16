import { DEFAULT_TEMPLATES, type Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { Section, SectionHeading } from './Section';

/**
 * Section 3 — Jak to działa (§10). The only numbered section (it IS a
 * sequence). Step 3 renders the ACTUAL heads-up SMS body verbatim from
 * DEFAULT_TEMPLATES.heads_up (source of truth, §7.2) in a phone bubble.
 */
export function HowItWorks({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).how;
  // Verbatim template body — the guest sees exactly this (placeholders shown
  // so an owner recognises the real message shape).
  const smsBody = DEFAULT_TEMPLATES.heads_up[locale] ?? DEFAULT_TEMPLATES.heads_up.pl;

  return (
    <Section id="how" className="bg-paper-hi/40">
      <SectionHeading>{c.heading}</SectionHeading>

      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {c.steps.map((step, i) => (
          <li
            key={step.n}
            className="rounded-card border border-ink/8 bg-paper-hi p-6 shadow-sm shadow-ink/5"
          >
            <span className="nums flex h-11 w-11 items-center justify-center rounded-pill bg-ink font-mono text-body font-semibold text-paper-hi">
              {step.n}
            </span>
            <h3 className="mt-4 text-card-name font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-small leading-relaxed text-ink-soft">{step.body}</p>

            {/* Step 3: the real heads-up SMS in a phone bubble */}
            {i === 2 ? (
              <figure className="mt-5">
                <figcaption className="mb-2 text-caption text-ink-soft">
                  {c.smsCaption}
                </figcaption>
                <div className="max-w-[15rem] rounded-2xl rounded-bl-sm bg-ready-fill px-4 py-3 text-small leading-relaxed text-paper-hi shadow-sm">
                  {smsBody}
                </div>
              </figure>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}
