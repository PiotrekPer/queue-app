/**
 * Thin, null-safe wrappers over the core time helpers (§6). Store UTC, render
 * Europe/Warsaw. Used when composing the `{{time}}` placeholder for the
 * `table_ready` / hold-deadline copy (e.g. „czekamy do 19:42").
 */
import { formatWarsawTime } from '@stoliq/core';

/** Render an ISO instant as „HH:MM" in Europe/Warsaw, '' for null/invalid. */
export function formatWarsawTimeSafe(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return formatWarsawTime(iso);
  } catch {
    return '';
  }
}
