import type { Metadata } from 'next';
import { resolveLocale } from '@/features/marketing/locale';
import { CennikBody } from '@/features/marketing/CennikBody';

export const metadata: Metadata = {
  title: 'Cennik — Stoliq',
  description:
    'Prosty cennik bez prowizji: Start 0 zł, Pro 149 zł netto/mc z SMS w cenie, Suite wkrótce.',
};

export default async function CennikPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { lang } = await searchParams;
  return <CennikBody locale={resolveLocale(lang)} />;
}
