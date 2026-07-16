import { resolveLocale } from '@/features/marketing/locale';
import { LandingBody } from '@/features/marketing/LandingBody';

/**
 * The landing (§10). Server-rendered per request so all copy is in the HTML
 * (SEO targets, §10). Composes all 8 sections in order via LandingBody. The
 * job: one tired venue owner, on a phone at 23:30, decides to try Stoliq.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { lang } = await searchParams;
  return <LandingBody locale={resolveLocale(lang)} />;
}
