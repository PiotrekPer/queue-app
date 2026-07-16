import Link from 'next/link';
import { DEFAULT_LOCALE, type Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { localeHref } from './locale';
import { Wordmark } from './Wordmark';

/**
 * Footer (§10) — ink on espresso (the one dark note besides the ForWaitress
 * band). Contact + legal links (Regulamin, Polityka prywatności, Umowa
 * powierzenia PDF) + PL/EN switch + „Made in PL/NL".
 */
export function Footer({ locale, path = '/' }: { locale: Locale; path?: string }) {
  const c = marketingCopy(locale).footer;

  return (
    <footer className="bg-espresso px-5 py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Wordmark className="text-steam" />
            <p className="mt-4 text-small leading-relaxed text-smoke">{c.tagline}</p>
          </div>

          <nav
            className="flex flex-col gap-3 text-small text-smoke"
            aria-label={marketingCopy(locale).nav.ariaFooter}
          >
            <Link
              href={localeHref('/kontakt', locale)}
              className="transition-colors hover:text-steam"
            >
              {c.contact}
            </Link>
            <Link href={localeHref('/regulamin', locale)} className="transition-colors hover:text-steam">
              {c.terms}
            </Link>
            <Link
              href={localeHref('/polityka-prywatnosci', locale)}
              className="transition-colors hover:text-steam"
            >
              {c.privacy}
            </Link>
            <a href="/docs/umowa-powierzenia.pdf" className="transition-colors hover:text-steam">
              {c.dpa}
            </a>
          </nav>
        </div>

        <div className="flex flex-col-reverse items-start gap-4 border-t border-hairline pt-6 text-caption text-smoke sm:flex-row sm:items-center sm:justify-between">
          <span>
            {c.rights} · {c.madeIn}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-smoke/70">{c.langLabel}:</span>
            <Link
              href={localeHref(path, DEFAULT_LOCALE)}
              aria-current={locale === 'pl' ? 'true' : undefined}
              className={locale === 'pl' ? 'font-semibold text-steam' : 'hover:text-steam'}
            >
              PL
            </Link>
            <span aria-hidden className="text-smoke/40">
              /
            </span>
            <Link
              href={localeHref(path, 'en')}
              aria-current={locale === 'en' ? 'true' : undefined}
              className={locale === 'en' ? 'font-semibold text-steam' : 'hover:text-steam'}
            >
              EN
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
