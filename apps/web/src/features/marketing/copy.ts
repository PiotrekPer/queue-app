/**
 * Marketing copy for the landing (CLAUDE.md §10). NOT part of core i18n —
 * this is product-marketing prose, PL default + EN mirror. No bare literals
 * in JSX: every section pulls its strings from here via `marketingCopy(locale)`.
 *
 * Voice (§9.5): warm-direct Polish, „Ty" form to owners, zero corporate-speak,
 * at most one emoji per message. Verbatim Polish from §10 where the spec gives it.
 */
import type { Locale } from '@stoliq/core';

export interface MarketingCopy {
  nav: {
    features: string;
    how: string;
    pricing: string;
    rodo: string;
    contact: string;
    cta: string;
    skipToContent: string;
    ariaMain: string;
    ariaFooter: string;
  };
  hero: {
    eyebrow: string;
    h1: string;
    sub: string;
    ctaPrimary: string;
    ctaGhost: string;
    demo: {
      title: string;
      queueHeader: string;
      guestHeader: string;
      notify: string;
      ready: string;
      readyHold: string;
      hint: string;
      waiting: string;
      live: string;
      position: string;
      positionCaption: string;
      cards: { name: string; meta: string }[];
    };
  };
  pain: {
    heading: string;
    stats: { value: string; label: string; source: string }[];
  };
  how: {
    heading: string;
    steps: { n: string; title: string; body: string }[];
    smsCaption: string;
  };
  forWaitress: {
    kicker: string;
    heading: string;
    sub: string;
    screens: { title: string; note: string }[];
  };
  pricing: {
    heading: string;
    sub: string;
    mostPopular: string;
    perMonth: string;
    soon: string;
    ctaFree: string;
    ctaPaid: string;
    footnote: string;
    plans: {
      name: string;
      price: string;
      tagline: string;
      features: string[];
      featured?: boolean;
      soon?: boolean;
      free?: boolean;
    }[];
  };
  rodo: {
    kicker: string;
    heading: string;
    points: { title: string; body: string }[];
  };
  caseStudy: {
    kicker: string;
    placeholder: string;
    sub: string;
  };
  faq: {
    heading: string;
    items: { q: string; a: string }[];
  };
  footer: {
    tagline: string;
    contact: string;
    terms: string;
    privacy: string;
    dpa: string;
    madeIn: string;
    langLabel: string;
    rights: string;
  };
  contactPage: {
    title: string;
    sub: string;
    emailLabel: string;
    email: string;
    phoneLabel: string;
    phone: string;
    hoursLabel: string;
    hours: string;
    demoLabel: string;
    demoBody: string;
  };
}

const pl: MarketingCopy = {
  nav: {
    features: 'Funkcje',
    how: 'Jak to działa',
    pricing: 'Cennik',
    rodo: 'RODO',
    contact: 'Kontakt',
    cta: 'Wypróbuj za darmo',
    skipToContent: 'Przejdź do treści',
    ariaMain: 'Główna nawigacja',
    ariaFooter: 'Nawigacja w stopce',
  },
  hero: {
    eyebrow: 'SYSTEM KOLEJKOWY I POWIADOMIENIA SMS · DLA GASTRONOMII',
    h1: 'Koniec z kolejką pod drzwiami.',
    sub: 'Goście skanują numerek, idą na spacer i wracają dokładnie na swój stolik. Ty prowadzisz kolejkę z telefonu.',
    ctaPrimary: 'Wypróbuj za darmo',
    ctaGhost: 'Zobacz demo 90 s',
    demo: {
      title: 'Dotknij „Powiadom", żeby zobaczyć',
      queueHeader: 'Kolejka',
      guestHeader: 'Numerek gościa',
      notify: 'Powiadom',
      ready: 'STOLIK GOTOWY',
      readyHold: 'czekamy na Was do 19:42',
      hint: 'Naciśnij „Powiadom" przy „Ania · 4 os."',
      waiting: 'ok. 20 min',
      live: 'na żywo',
      position: '3.',
      positionCaption: 'w kolejce',
      cards: [
        { name: 'Ania', meta: '4 os.' },
        { name: 'Marek', meta: '2 os.' },
        { name: 'Kasia', meta: '3 os.' },
      ],
    },
  },
  pain: {
    heading: 'Kolejka pod drzwiami kosztuje więcej, niż myślisz.',
    stats: [
      {
        value: '~20 min',
        label: 'tyle goście czekają, zanim rezygnują',
        source: 'Obserwacje z lokali walk-in w godzinach szczytu.',
      },
      {
        value: '72%',
        label: 'nie zaczeka dłużej niż 30 minut',
        source: 'Badania zachowań gości w gastronomii.',
      },
      {
        value: '100 000+ zł',
        label: '5 straconych stolików dziennie ≈ tyle rocznie',
        source: 'Szacunek przy średnim rachunku i obłożeniu weekendowym.',
      },
    ],
  },
  how: {
    heading: 'Jak to działa',
    steps: [
      {
        n: '1',
        title: 'Dodajesz gości w 5 sekund',
        body: 'Wybierasz liczbę osób, opcjonalnie imię — gotowe. Jedną ręką, w biegu.',
      },
      {
        n: '2',
        title: 'Gość skanuje numerek',
        body: 'Bez aplikacji, bez logowania. Widzi swoją pozycję i czas na żywo.',
      },
      {
        n: '3',
        title: 'SMS ściąga ich z powrotem',
        body: 'Gdy zbliża się ich kolej, dostają wiadomość i wracają dokładnie na czas.',
      },
    ],
    smsCaption: 'Dokładnie taką wiadomość dostaje gość:',
  },
  forWaitress: {
    kicker: 'DLA KELNERKI, NIE DLA INFORMATYKA',
    heading: 'Dwa telefony, jedna kolejka. Na żywo.',
    sub: 'Prowadzisz kolejkę ze swojego telefonu. Koleżanka przy drugim widzi to samo w tej samej sekundzie. Zero szkoleń, zero terminala.',
    screens: [
      { title: 'Kolejka', note: 'Cała sala na jednym ekranie' },
      { title: 'Numerek', note: 'To, co dostaje gość' },
      { title: 'Dziś', note: 'Podsumowanie na koniec zmiany' },
    ],
  },
  pricing: {
    heading: 'Prosty cennik. Zero prowizji.',
    sub: 'Płacisz stałą kwotę, nie od głowy. Zaczynasz za darmo.',
    mostPopular: 'najczęściej wybierany',
    perMonth: 'netto/mc',
    soon: 'wkrótce',
    ctaFree: 'Zacznij za darmo',
    ctaPaid: 'Wybierz Pro',
    footnote:
      'Zero prowizji od osoby. Stała cena. Rezygnujesz kiedy chcesz. SMS ponad pakiet: 0,15 zł/SMS.',
    plans: [
      {
        name: 'Start',
        price: '0 zł',
        tagline: 'Na dobry początek',
        free: true,
        features: ['Kolejka na telefonie', 'Strona numerka dla gości', 'Bez SMS'],
      },
      {
        name: 'Pro',
        price: '149 zł',
        tagline: 'Dla lokali z ruchem',
        featured: true,
        features: [
          'SMS w cenie: 500/mc',
          'Wiadomość „wracaj powoli" (heads-up)',
          'Statystyki dzienne mailem',
          '2 urządzenia i więcej',
        ],
      },
      {
        name: 'Suite',
        price: '299 zł',
        tagline: 'Rezerwacje i więcej',
        soon: true,
        features: ['Wszystko z Pro', 'Rezerwacje z zadatkiem', 'Eksport bazy gości'],
      },
    ],
  },
  rodo: {
    kicker: 'RODO',
    heading: 'Dane gości pod kontrolą. Bez prawnika.',
    points: [
      {
        title: 'Dane w Unii',
        body: 'Serwery we Frankfurcie (UE). Nic nie wypływa poza Europę.',
      },
      {
        title: 'Auto-usuwanie',
        body: 'Numery gości znikają automatycznie po 30, 60 lub 90 dniach — Ty wybierasz.',
      },
      {
        title: 'Umowa powierzenia w cenie',
        body: 'Gotowy dokument do podpisu przy zakładaniu konta. Bez dopłat.',
      },
      {
        title: 'Gość sam podaje numer',
        body: 'To gość wpisuje telefon na swoim ekranie. Ty niczego nie przepisujesz.',
      },
    ],
  },
  caseStudy: {
    kicker: 'HISTORIE Z LOKALI',
    placeholder: 'Pilotaż trwa — wyniki wkrótce',
    sub: 'Testujemy Stoliq w kilku warszawskich lokalach. Pierwsze liczby pokażemy tu, gdy tylko będą prawdziwe.',
  },
  faq: {
    heading: 'Częste pytania',
    items: [
      {
        q: 'Co jeśli gość nie ma smartfona?',
        a: 'Kelnerka woła go jak zawsze — system w niczym nie przeszkadza. Numerek jest dodatkiem, nie warunkiem.',
      },
      {
        q: 'Ile kosztują SMS-y?',
        a: 'W planie Pro masz 500 SMS-ów miesięcznie w cenie. Powyżej pakietu — 0,15 zł za SMS. W planie Start SMS-ów nie ma, gość śledzi kolejkę na stronie.',
      },
      {
        q: 'Czy goście muszą coś instalować?',
        a: 'Nie. Nic. Skanują kod, otwiera się strona z numerkiem. Zero aplikacji, zero logowania.',
      },
      {
        q: 'Co z RODO?',
        a: 'Dane trzymamy w UE (Frankfurt), gość sam podaje numer, a numery kasują się automatycznie po ustalonym czasie. Umowę powierzenia dostajesz w cenie.',
      },
      {
        q: 'Działa bez internetu?',
        a: 'Aplikacja ma tryb offline na chwilowe zaniki sieci — dodajesz i sadzasz gości dalej, a wszystko synchronizuje się, gdy sieć wróci.',
      },
    ],
  },
  footer: {
    tagline: 'System kolejkowy i powiadomienia SMS dla restauracji.',
    contact: 'Kontakt',
    terms: 'Regulamin',
    privacy: 'Polityka prywatności',
    dpa: 'Umowa powierzenia (PDF)',
    madeIn: 'Made in PL/NL',
    langLabel: 'Język',
    rights: '© 2026 Stoliq',
  },
  contactPage: {
    title: 'Porozmawiajmy.',
    sub: 'Masz lokal z kolejką pod drzwiami? Napisz — pokażemy Stoliq na Twoim piątku.',
    emailLabel: 'E-mail',
    email: 'kontakt@stoliq.app',
    phoneLabel: 'Telefon',
    phone: '+48 500 000 000',
    hoursLabel: 'Godziny',
    hours: 'Pon.–Pt. 9:00–18:00',
    demoLabel: 'Demo',
    demoBody: 'Umów 15-minutowe demo na żywo — bez zobowiązań.',
  },
};

const en: MarketingCopy = {
  nav: {
    features: 'Features',
    how: 'How it works',
    pricing: 'Pricing',
    rodo: 'GDPR',
    contact: 'Contact',
    cta: 'Try it free',
    skipToContent: 'Skip to content',
    ariaMain: 'Main navigation',
    ariaFooter: 'Footer navigation',
  },
  hero: {
    eyebrow: 'QUEUE SYSTEM AND SMS NOTIFICATIONS · FOR RESTAURANTS',
    h1: 'No more queue at the door.',
    sub: 'Guests scan a ticket, take a walk, and come back exactly to their table. You run the queue from your phone.',
    ctaPrimary: 'Try it free',
    ctaGhost: 'Watch 90 s demo',
    demo: {
      title: 'Tap „Notify" to see it',
      queueHeader: 'Queue',
      guestHeader: 'Guest ticket',
      notify: 'Notify',
      ready: 'TABLE READY',
      readyHold: "we'll hold it until 19:42",
      hint: 'Press „Notify" on „Ania · 4 people"',
      waiting: '~20 min',
      live: 'live',
      position: '3.',
      positionCaption: 'in queue',
      cards: [
        { name: 'Ania', meta: '4 ppl' },
        { name: 'Marek', meta: '2 ppl' },
        { name: 'Kasia', meta: '3 ppl' },
      ],
    },
  },
  pain: {
    heading: 'A queue at the door costs more than you think.',
    stats: [
      {
        value: '~20 min',
        label: 'how long guests wait before they give up',
        source: 'Observations from walk-in venues at peak hours.',
      },
      {
        value: '72%',
        label: "won't wait longer than 30 minutes",
        source: 'Guest behaviour studies in hospitality.',
      },
      {
        value: '100,000+ zł',
        label: '5 lost tables a day ≈ this much per year',
        source: 'Estimate at an average check and weekend occupancy.',
      },
    ],
  },
  how: {
    heading: 'How it works',
    steps: [
      {
        n: '1',
        title: 'Add guests in 5 seconds',
        body: 'Pick party size, optionally a name — done. One-handed, on the move.',
      },
      {
        n: '2',
        title: 'The guest scans a ticket',
        body: 'No app, no login. They see their position and time, live.',
      },
      {
        n: '3',
        title: 'SMS brings them back',
        body: 'When their turn is near, they get a message and return right on time.',
      },
    ],
    smsCaption: 'This is the exact message the guest gets:',
  },
  forWaitress: {
    kicker: 'FOR THE WAITER, NOT THE IT DEPARTMENT',
    heading: 'Two phones, one queue. Live.',
    sub: 'You run the queue from your phone. A colleague on the next one sees the same thing in the same second. Zero training, zero terminal.',
    screens: [
      { title: 'Queue', note: 'The whole room on one screen' },
      { title: 'Ticket', note: "What the guest gets" },
      { title: 'Today', note: 'End-of-shift summary' },
    ],
  },
  pricing: {
    heading: 'Simple pricing. Zero commission.',
    sub: 'You pay a flat fee, not per head. You start for free.',
    mostPopular: 'most popular',
    perMonth: 'net/mo',
    soon: 'soon',
    ctaFree: 'Start for free',
    ctaPaid: 'Choose Pro',
    footnote:
      'Zero per-person commission. Flat price. Cancel anytime. SMS over the bundle: 0.15 zł/SMS.',
    plans: [
      {
        name: 'Start',
        price: '0 zł',
        tagline: 'To get going',
        free: true,
        features: ['Queue on your phone', 'Guest ticket page', 'No SMS'],
      },
      {
        name: 'Pro',
        price: '149 zł',
        tagline: 'For busy venues',
        featured: true,
        features: [
          'SMS included: 500/mo',
          '„Head back slowly" heads-up message',
          'Daily stats by email',
          '2 devices and more',
        ],
      },
      {
        name: 'Suite',
        price: '299 zł',
        tagline: 'Reservations and more',
        soon: true,
        features: ['Everything in Pro', 'Reservations with deposits', 'Guest database export'],
      },
    ],
  },
  rodo: {
    kicker: 'GDPR',
    heading: 'Guest data under control. No lawyer needed.',
    points: [
      {
        title: 'Data in the EU',
        body: 'Servers in Frankfurt (EU). Nothing leaves Europe.',
      },
      {
        title: 'Auto-deletion',
        body: 'Guest numbers vanish automatically after 30, 60 or 90 days — you choose.',
      },
      {
        title: 'Processing agreement included',
        body: 'A ready document to sign at signup. No extra cost.',
      },
      {
        title: 'The guest enters their own number',
        body: 'The guest types their phone on their own screen. You copy nothing.',
      },
    ],
  },
  caseStudy: {
    kicker: 'STORIES FROM VENUES',
    placeholder: 'Pilot in progress — results soon',
    sub: 'We are testing Stoliq in a few Warsaw venues. The first real numbers will land here as soon as they are real.',
  },
  faq: {
    heading: 'Frequently asked',
    items: [
      {
        q: 'What if a guest has no smartphone?',
        a: 'The waiter calls them like always — the system never gets in the way. The ticket is an add-on, not a requirement.',
      },
      {
        q: 'How much do SMS cost?',
        a: 'On the Pro plan you get 500 SMS a month included. Above the bundle — 0.15 zł per SMS. On Start there are no SMS; the guest tracks the queue on the page.',
      },
      {
        q: 'Do guests have to install anything?',
        a: 'No. Nothing. They scan a code and a ticket page opens. Zero apps, zero login.',
      },
      {
        q: 'What about GDPR?',
        a: 'Data stays in the EU (Frankfurt), the guest enters their own number, and numbers auto-delete after a set time. The processing agreement is included.',
      },
      {
        q: 'Does it work without internet?',
        a: 'The app has an offline mode for short outages — you keep adding and seating guests, and everything syncs when the network is back.',
      },
    ],
  },
  footer: {
    tagline: 'Queue system and SMS notifications for restaurants.',
    contact: 'Contact',
    terms: 'Terms',
    privacy: 'Privacy policy',
    dpa: 'Processing agreement (PDF)',
    madeIn: 'Made in PL/NL',
    langLabel: 'Language',
    rights: '© 2026 Stoliq',
  },
  contactPage: {
    title: "Let's talk.",
    sub: 'Got a venue with a queue at the door? Write to us — we will show Stoliq on your Friday.',
    emailLabel: 'Email',
    email: 'kontakt@stoliq.app',
    phoneLabel: 'Phone',
    phone: '+48 500 000 000',
    hoursLabel: 'Hours',
    hours: 'Mon–Fri 9:00–18:00',
    demoLabel: 'Demo',
    demoBody: 'Book a 15-minute live demo — no strings attached.',
  },
};

const COPY: Record<Locale, MarketingCopy> = { pl, en };

/** Pick the marketing copy for a locale (pl default, §1.6). */
export function marketingCopy(locale: Locale = 'pl'): MarketingCopy {
  return COPY[locale] ?? pl;
}
