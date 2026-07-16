import type { Locale } from '@stoliq/core';
import { Hero } from './Hero';
import { PainStats } from './PainStats';
import { HowItWorks } from './HowItWorks';
import { ForWaitress } from './ForWaitress';
import { Pricing } from './Pricing';
import { RodoBlock } from './RodoBlock';
import { CaseStudy } from './CaseStudy';
import { Faq } from './Faq';

/**
 * Composes the 8 landing sections in order (§10). Server component — the whole
 * page is server-rendered per request so all copy is in the HTML for SEO.
 * Only the leaf interactive bits (demo, FAQ accordion) are client islands.
 */
export function LandingBody({ locale }: { locale: Locale }) {
  return (
    <>
      <Hero locale={locale} />
      <PainStats locale={locale} />
      <HowItWorks locale={locale} />
      <ForWaitress locale={locale} />
      <Pricing locale={locale} />
      <RodoBlock locale={locale} />
      <CaseStudy locale={locale} />
      <Faq locale={locale} />
    </>
  );
}
