/**
 * Guest link builder (§7.2). Every SMS/email {{link}} points at the live ticket
 * page `GUEST_BASE_URL/v/{token}` (short domain stq.pl). Links are always built
 * server-side (§12.5) so the token never leaks into a client bundle.
 */
import { optionalEnv } from './admin.ts';

/** Fallback base URL when GUEST_BASE_URL is unset (matches §12.5 default). */
export const DEFAULT_GUEST_BASE_URL = 'https://stq.pl';

/** `GUEST_BASE_URL/v/{token}` with a single, clean slash. */
export function ticketLink(token: string): string {
  const base = (optionalEnv('GUEST_BASE_URL') ?? DEFAULT_GUEST_BASE_URL).replace(/\/+$/, '');
  return `${base}/v/${token}`;
}
