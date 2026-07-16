'use client';

/**
 * PostHog provider for marketing routes only (§12.4 — guest routes stay
 * tracker-free). This is a HARD no-op unless a PostHog key is configured, and
 * it does not bundle `posthog-js`: if a real PostHog snippet is present on
 * `window` it will be used by `analytics.capture`, otherwise events vanish.
 *
 * Kept as a client component so it can later attach a real SDK without
 * touching the layout. For now it renders children and, when a key exists,
 * fires a lightweight pageview marker.
 */
import { useEffect } from 'react';
import { analyticsEnabled, capture } from './analytics';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!analyticsEnabled) return;
    capture('$pageview');
  }, []);

  return <>{children}</>;
}
