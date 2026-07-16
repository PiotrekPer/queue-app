import type { Metadata } from 'next';
import { resolveLocale } from '@/features/marketing/locale';
import { KontaktBody } from '@/features/marketing/KontaktBody';

export const metadata: Metadata = {
  title: 'Kontakt — Stoliq',
  description: 'Napisz do nas — pokażemy Stoliq na Twoim piątku. Demo na żywo, bez zobowiązań.',
};

export default async function KontaktPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { lang } = await searchParams;
  return <KontaktBody locale={resolveLocale(lang)} />;
}
