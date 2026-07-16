import type { Metadata } from 'next';
import { PageIntro } from '@/features/marketing/PageIntro';
import { Section } from '@/features/marketing/Section';
import { resolveLocale } from '@/features/marketing/locale';

export const metadata: Metadata = {
  title: 'Regulamin — Stoliq',
  description: 'Regulamin korzystania z usługi Stoliq (system kolejkowy + powiadomienia SMS).',
};

const COPY = {
  pl: {
    kicker: 'DOKUMENTY',
    title: 'Regulamin',
    sub: 'Zasady korzystania z usługi Stoliq dla lokali gastronomicznych.',
    sections: [
      ['§1. Usługa', 'Stoliq to staff-first wirtualna kolejka: personel prowadzi kolejkę z telefonu, a gość otrzymuje cyfrowy numerek (stronę statusu) oraz maksymalnie trzy wiadomości serwisowe na wizytę.'],
      ['§2. Konto i plany', 'Plan Start (0 zł) obejmuje kolejkę i stronę numerka. Plany Pro (149 zł netto/mc) i Suite (299 zł netto/mc) dodają SMS, uprzedzenie oraz statystyki. Rezygnacja jest możliwa w dowolnym momencie, bez prowizji od osoby.'],
      ['§3. SMS i płatności', 'Wiadomości SMS są rozliczane z prepaidowego salda lokalu. Ceny i pakiety opisano na stronie Cennik. Rozliczenia obsługiwane są przez zewnętrznego operatora płatności.'],
      ['§4. Odpowiedzialność', 'Dokładamy starań o ciągłość działania; aplikacja personelu ma tryb offline na chwilowe zaniki sieci. Stoliq nie odpowiada za działania siły wyższej ani za treści wprowadzane przez lokal.'],
      ['§5. Dane osobowe', 'Zasady przetwarzania danych opisano w Polityce prywatności oraz w Umowie powierzenia (art. 28 RODO), akceptowanej przy rejestracji lokalu.'],
    ],
  },
  en: {
    kicker: 'DOCUMENTS',
    title: 'Terms of Service',
    sub: 'Terms for using Stoliq at hospitality venues.',
    sections: [
      ['§1. The service', 'Stoliq is a staff-first virtual queue: staff run the queue from their phone, and the guest gets a digital ticket (status page) plus at most three service messages per visit.'],
      ['§2. Account & plans', 'The Start plan (free) covers the queue and the ticket page. Pro (149 zł/mo net) and Suite (299 zł/mo net) add SMS, heads-up and analytics. Cancel anytime, no per-person commission.'],
      ['§3. SMS & payments', 'SMS is billed from the venue prepaid balance. Prices and bundles are on the Pricing page. Payments are handled by an external payment provider.'],
      ['§4. Liability', 'We strive for continuous operation; the staff app has an offline mode for brief outages. Stoliq is not liable for force majeure or venue-entered content.'],
      ['§5. Personal data', 'Data processing is described in the Privacy Policy and the Data Processing Agreement (GDPR art. 28), accepted at venue signup.'],
    ],
  },
} as const;

export default async function RegulaminPage({
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
