import type { Metadata } from 'next';
import '../../src/features/guest/guest.css';

/**
 * Guest route group (§8). Paper surface, no tracking cookies / PostHog (guest
 * routes stay tracker-free). This is a NESTED layout — the root layout owns
 * <html>/<body> and fonts; here we only scope guest styles and default meta.
 */
export const metadata: Metadata = {
  // Ticket pages must never be indexed (per-visit, ephemeral, PII-adjacent).
  robots: { index: false, follow: false },
};

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
