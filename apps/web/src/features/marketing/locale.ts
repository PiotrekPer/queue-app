/**
 * Resolve the marketing locale from a `?lang=` search param. pl is the default
 * (§1.6); en is the only fallback (LOCALES). The landing/footer expose a PL/EN
 * switch that just toggles this param — no cookies, no redirect.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@stoliq/core';

export function resolveLocale(raw: string | string[] | undefined): Locale {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (LOCALES as readonly string[]).includes(value ?? '')
    ? (value as Locale)
    : DEFAULT_LOCALE;
}

/** Build an href on the same path that switches to the given locale. */
export function localeHref(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}lang=${locale}`;
}
