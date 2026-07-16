/**
 * Local copy for the Add flow + QR screen. Most strings come from the shared
 * i18n bundle (staff.* / common.* / guest.*). These are the few labels that
 * have no key in @stoliq/core yet — kept here so we never edit the core package
 * from a feature track (per working agreement). pl default, en fallback.
 *
 * Voice: warm-direct „Ty" form, buttons say what happens (§9.5).
 */
import { useTranslation } from 'react-i18next';

type Lang = 'pl' | 'en';

const COPY: Record<Lang, Record<string, string>> = {
  pl: {
    addTitle: 'Nowy gość',
    sizeMore: '9+',
    sizeCustomTitle: 'Ile dokładnie?',
    sizeCustomDone: 'Dalej →',
    quotePrefix: 'ok.',
    quoteAdjustHint: 'Dotknij +/− aby zmienić',
    close: 'Zamknij',
  },
  en: {
    addTitle: 'New guest',
    sizeMore: '9+',
    sizeCustomTitle: 'How many exactly?',
    sizeCustomDone: 'Next →',
    quotePrefix: 'approx.',
    quoteAdjustHint: 'Tap +/− to change',
    close: 'Close',
  },
};

/** Feature-local translator: falls back to pl, then to the raw key. */
export function useAddCopy(): (key: keyof (typeof COPY)['pl']) => string {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language?.startsWith('en') ? 'en' : 'pl';
  return (key) => COPY[lang][key] ?? COPY.pl[key] ?? String(key);
}
