import Link from 'next/link';
import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { localeHref } from './locale';
import { HostStandDemo } from './HostStandDemo';

/**
 * Hero (§10). The signature surface: big Bricolage H1 + the playable
 * host-stand demo. CTAs — primary ready-fill „Wypróbuj za darmo", ghost
 * „Zobacz demo 90 s" that jumps to the on-page demo.
 */
export function Hero({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).hero;

  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-10">
        <div className="text-center lg:text-left">
          <p className="mb-5 font-mono text-caption uppercase tracking-[0.12em] text-ink-soft">
            {c.eyebrow}
          </p>
          <h1 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[52px] lg:text-[56px]">
            {c.h1}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-body text-ink-soft lg:mx-0">{c.sub}</p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <Link
              href={localeHref('/kontakt', locale)}
              className="inline-flex h-14 items-center justify-center rounded-pill bg-ready-fill px-8 text-body font-semibold text-paper-hi transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {c.ctaPrimary}
            </Link>
            <a
              href="#demo"
              className="inline-flex h-14 items-center justify-center rounded-pill border border-ink/15 px-8 text-body font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {c.ctaGhost}
            </a>
          </div>
        </div>

        <div id="demo" className="scroll-mt-24">
          <p className="mb-4 text-center text-caption text-ink-soft lg:text-left">
            {c.demo.title}
          </p>
          <HostStandDemo locale={locale} />
        </div>
      </div>
    </section>
  );
}
