import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';
import { PageIntro } from './PageIntro';
import { Pricing } from './Pricing';
import { Faq } from './Faq';

/** /cennik body — reuses the Pricing block + FAQ under a page intro. */
export function CennikBody({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).pricing;
  return (
    <>
      <PageIntro title={c.heading} sub={c.sub} />
      <Pricing locale={locale} heading={false} />
      <Faq locale={locale} />
    </>
  );
}
