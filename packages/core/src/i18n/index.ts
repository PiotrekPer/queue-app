/**
 * i18n resources for i18next / react-i18next (§2, §9.5). `pl` is the default,
 * `en` the fallback. Keys live here in `packages/core` so app + web share them.
 */
import { en } from './en';
import { pl } from './pl';

export { pl } from './pl';
export { en } from './en';
export type { Translation } from './pl';

export const defaultNS = 'translation' as const;

/** i18next `resources` object. */
export const resources = {
  pl: { translation: pl },
  en: { translation: en },
} as const;

export const supportedLngs = ['pl', 'en'] as const;
export const fallbackLng = 'pl';
