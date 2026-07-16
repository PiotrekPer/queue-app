import type { Metadata } from 'next';
import { resolveLocale } from '@/features/marketing/locale';
import { RodoBody } from '@/features/marketing/RodoBody';

export const metadata: Metadata = {
  title: 'RODO — Stoliq',
  description:
    'Dane gości w UE (Frankfurt), auto-usuwanie po 30/60/90 dniach, umowa powierzenia w cenie, gość sam podaje numer.',
};

export default async function RodoPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { lang } = await searchParams;
  return <RodoBody locale={resolveLocale(lang)} />;
}
