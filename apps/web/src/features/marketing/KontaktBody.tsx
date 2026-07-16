import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { PageIntro } from './PageIntro';
import { Section } from './Section';

/** /kontakt body — simple, honest contact details + a demo prompt. */
export function KontaktBody({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).contactPage;
  const cta = marketingCopy(locale).nav.cta;

  const rows: { label: string; value: string; href?: string }[] = [
    { label: c.emailLabel, value: c.email, href: `mailto:${c.email}` },
    { label: c.phoneLabel, value: c.phone, href: `tel:${c.phone.replace(/\s/g, '')}` },
    { label: c.hoursLabel, value: c.hours },
  ];

  return (
    <>
      <PageIntro title={c.title} sub={c.sub} />
      <Section className="pt-4">
        <div className="grid gap-5 sm:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-card border border-ink/8 bg-paper-hi p-6 shadow-sm shadow-ink/5"
            >
              <p className="text-caption uppercase tracking-[0.08em] text-ink-soft">{r.label}</p>
              {r.href ? (
                <a
                  href={r.href}
                  className="mt-2 block text-body font-semibold text-ink underline decoration-ready-paper/40 underline-offset-4 hover:decoration-ready-paper"
                >
                  {r.value}
                </a>
              ) : (
                <p className="mt-2 text-body font-semibold text-ink">{r.value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-card border-2 border-ready-paper bg-paper-hi p-7">
          <p className="text-caption uppercase tracking-[0.08em] text-ink-soft">{c.demoLabel}</p>
          <p className="mt-2 max-w-md text-body text-ink">{c.demoBody}</p>
          <a
            href={`mailto:${c.email}`}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-pill bg-ready-fill px-7 text-body font-semibold text-paper-hi transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {cta}
          </a>
        </div>
      </Section>
    </>
  );
}
