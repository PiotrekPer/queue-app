/**
 * Marketing-only analytics (§12.4). Guest routes are NEVER tracked; only the
 * (marketing) route group uses this.
 *
 * We do NOT bundle `posthog-js` (keeps the landing lean and avoids a dep).
 * Instead we defer to a `window.posthog` if a real snippet is ever injected,
 * and otherwise no-op. The whole thing is a hard no-op unless a PostHog key
 * is configured — so local/dev never fires events.
 */
import { env } from '@/lib/env';

type Props = Record<string, string | number | boolean | null>;

interface PostHogLike {
  capture: (event: string, props?: Props) => void;
}

function client(): PostHogLike | null {
  if (!env.posthogKey) return null;
  if (typeof window === 'undefined') return null;
  const ph = (window as unknown as { posthog?: PostHogLike }).posthog;
  return ph ?? null;
}

/** True when marketing analytics is live (key present). */
export const analyticsEnabled = env.posthogKey.length > 0;

/** Capture a marketing event; silently no-ops without a key or client. */
export function capture(event: string, props?: Props): void {
  const ph = client();
  if (!ph) return;
  try {
    ph.capture(event, props);
  } catch {
    // Analytics must never break the page.
  }
}
