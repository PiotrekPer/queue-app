import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketingChrome } from '@/features/marketing/MarketingChrome';
import { PostHogProvider } from '@/features/marketing/PostHogProvider';

/**
 * (marketing) route group layout (§10). Paper surface, Nav + Footer chrome,
 * PostHog (no-op without a key — marketing routes MAY track, guest routes never,
 * §12.4). Small scoped keyframes for the demo stamp + live dot, disabled under
 * reduced motion. Suspense wraps the chrome because it reads `?lang=`.
 */
export const metadata: Metadata = {
  title: 'Stoliq — system kolejkowy i powiadomienia SMS dla restauracji',
  description:
    'Goście skanują numerek, idą na spacer i wracają dokładnie na swój stolik. Ty prowadzisz kolejkę z telefonu. System kolejkowy i powiadomienia SMS dla gastronomii.',
  keywords: [
    'system kolejkowy dla restauracji',
    'wirtualna kolejka',
    'powiadomienia SMS o stoliku',
    'aplikacja do kolejki gastronomia',
  ],
  openGraph: {
    title: 'Stoliq — system kolejkowy i powiadomienia SMS dla restauracji',
    description:
      'Goście skanują numerek, idą na spacer i wracają dokładnie na swój stolik.',
    locale: 'pl_PL',
    type: 'website',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <div className="min-h-dvh bg-paper text-ink">
        <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
          <MarketingChrome>{children}</MarketingChrome>
        </Suspense>
      </div>

      {/* Scoped motion (globals.css is owned; keep it out of there). Reduced
          motion disables the stamp scale and dot pulse — crossfade only (§9.2). */}
      <style>{`
        @keyframes stoliq-stamp {
          0%   { transform: scale(1.4) rotate(-8deg); opacity: 0; }
          100% { transform: scale(1) rotate(-3deg); opacity: 1; }
        }
        .stamp-in { animation: stoliq-stamp 240ms cubic-bezier(0.2,0.9,0.3,1.15) both; }
        @keyframes stoliq-dot {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        .live-dot { animation: stoliq-dot 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .stamp-in { animation: none; }
          .live-dot { animation: none; }
        }
      `}</style>
    </PostHogProvider>
  );
}
