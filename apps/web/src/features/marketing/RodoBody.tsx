import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { PageIntro } from './PageIntro';
import { RodoBlock } from './RodoBlock';

/** /rodo body — reuses the RODO trust block under a page intro. */
export function RodoBody({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).rodo;
  return (
    <>
      <PageIntro kicker={c.kicker} title={c.heading} />
      <RodoBlock locale={locale} heading={false} />
    </>
  );
}
