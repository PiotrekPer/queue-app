'use client';

/**
 * Client chrome for the (marketing) group: Nav + Footer + skip-link. Reads the
 * `?lang=` param ONLY for its own (non-SEO) locale so it can stay in the layout
 * across pages. The SEO-critical page content is `children` — server-rendered
 * per page from `searchParams` (see each page.tsx) — so it is fully in the HTML.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { marketingCopy } from './copy';
import { resolveLocale } from './locale';
import { Nav } from './Nav';
import { Footer } from './Footer';

export function MarketingChrome({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname() || '/';
  const locale = resolveLocale(params.get('lang') ?? undefined);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-control bg-ink px-3 py-2 text-small text-paper-hi focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {marketingCopy(locale).nav.skipToContent}
      </a>
      <Nav locale={locale} />
      <main id="main">{children}</main>
      <Footer locale={locale} path={pathname} />
    </>
  );
}
