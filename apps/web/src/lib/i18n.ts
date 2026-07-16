/**
 * Lightweight i18n for the web (guest budget <100KB JS, §8): resolves dotted
 * keys against the shared @stoliq/core resources and interpolates {{vars}}.
 * Works in server + client components without shipping the full i18next runtime.
 */
import { resources, type Locale } from '@stoliq/core';

type Vars = Record<string, string | number>;

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) =>
    vars[k] === undefined ? '' : String(vars[k]),
  );
}

function resolvePath(dict: unknown, path: string): string {
  let cur: unknown = dict;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return path; // fall back to the key itself (visible = missing translation)
    }
  }
  return typeof cur === 'string' ? cur : path;
}

export type TFunc = (key: string, vars?: Vars) => string;

/** Build a translator bound to a locale. Defaults to pl (§1.6). */
export function createT(locale: Locale = 'pl'): TFunc {
  const dict = resources[locale].translation;
  return (key, vars) => interpolate(resolvePath(dict, key), vars);
}
