import Link from 'next/link';
import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { localeHref } from './locale';
import { Wordmark } from './Wordmark';

/**
 * Marketing top nav. Paper surface, quiet — one bold moment lives in the hero,
 * not here (§8 principle 8). Anchor links to on-page sections + the primary CTA.
 */
export function Nav({ locale }: { locale: Locale }) {
  const t = marketingCopy(locale).nav;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/85 backdrop-blur-md">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"
        aria-label={t.ariaMain}
      >
        <Link
          href={localeHref('/', locale)}
          className="rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ready-paper"
          aria-label="Stoliq"
        >
          <Wordmark className="text-ink" />
        </Link>

        <div className="hidden items-center gap-7 text-small text-ink-soft md:flex">
          <a href="#how" className="transition-colors hover:text-ink">
            {t.how}
          </a>
          <Link
            href={localeHref('/cennik', locale)}
            className="transition-colors hover:text-ink"
          >
            {t.pricing}
          </Link>
          <Link href={localeHref('/rodo', locale)} className="transition-colors hover:text-ink">
            {t.rodo}
          </Link>
          <Link
            href={localeHref('/kontakt', locale)}
            className="transition-colors hover:text-ink"
          >
            {t.contact}
          </Link>
        </div>

        <Link
          href={localeHref('/kontakt', locale)}
          className="inline-flex h-11 items-center rounded-pill bg-ready-fill px-5 text-small font-semibold text-paper-hi transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {t.cta}
        </Link>
      </nav>
    </header>
  );
}
