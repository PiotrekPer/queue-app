import type { Metadata } from 'next';
import { PageIntro } from '@/features/marketing/PageIntro';
import { Section } from '@/features/marketing/Section';
import { resolveLocale } from '@/features/marketing/locale';

export const metadata: Metadata = {
  title: 'Polityka prywatności — Stoliq',
  description:
    'Jak Stoliq przetwarza dane gości: minimalizacja, UE (Frankfurt), auto-usuwanie po 30/60/90 dniach.',
};

const COPY = {
  pl: {
    kicker: 'DOKUMENTY',
    title: 'Polityka prywatności',
    sub: 'Minimalnie danych, w UE, z widocznym auto-usuwaniem. RODO to funkcja, nie stopka.',
    sections: [
      ['Jakie dane', 'Gość podaje samodzielnie, na własnym urządzeniu, wyłącznie: opcjonalne imię, opcjonalny numer telefonu (+48…) lub e-mail. Nie zbieramy dat urodzenia, adresów ani danych szczególnych kategorii.'],
      ['Po co', 'Dane służą wyłącznie do powiadomień o bieżącej wizycie (wykonanie usługi). Zgoda marketingowa jest odrębna i domyślnie niezaznaczona.'],
      ['Gdzie', 'Dane przetwarzamy w Unii Europejskiej (Supabase, Frankfurt). Subprocesorzy: SMSAPI.pl (SMS, Polska), Resend (e-mail, UE).'],
      ['Jak długo', 'Dane gościa usuwamy automatycznie po okresie retencji ustawionym przez lokal (30 / 60 / 90 dni). Pozostają wyłącznie zanonimizowane rekordy do statystyk.'],
      ['Twoje prawa', 'Przysługuje prawo dostępu, sprostowania, usunięcia i sprzeciwu. Administratorem danych gości jest lokal; Stoliq jest podmiotem przetwarzającym (Umowa powierzenia, art. 28 RODO).'],
    ],
  },
  en: {
    kicker: 'DOCUMENTS',
    title: 'Privacy Policy',
    sub: 'Minimal data, in the EU, with visible auto-deletion. GDPR is a feature, not a footer.',
    sections: [
      ['What data', 'The guest enters, on their own device, only: an optional first name, an optional phone number (+48…) or email. We never collect birthdays, addresses, or special-category data.'],
      ['Why', 'Data is used solely for notifications about the current visit (performance of service). Marketing consent is separate and unticked by default.'],
      ['Where', 'Data is processed in the European Union (Supabase, Frankfurt). Subprocessors: SMSAPI.pl (SMS, Poland), Resend (email, EU).'],
      ['How long', 'Guest data is deleted automatically after the venue-set retention (30 / 60 / 90 days). Only anonymized records remain for statistics.'],
      ['Your rights', 'You have the right to access, rectify, erase and object. The venue is the controller of guest data; Stoliq is the processor (DPA, GDPR art. 28).'],
    ],
  },
} as const;

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { lang } = await searchParams;
  const copy = COPY[resolveLocale(lang)];
  return (
    <>
      <PageIntro kicker={copy.kicker} title={copy.title} sub={copy.sub} />
      <Section className="pt-2">
        <div className="mx-auto max-w-2xl space-y-8">
          {copy.sections.map(([heading, body]) => (
            <div key={heading}>
              <h2 className="font-display text-h2 font-bold text-ink">{heading}</h2>
              <p className="mt-2 text-body leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
