import type { Locale } from '@stoliq/core';
import { createT } from '@/lib/i18n';

/**
 * Pulsing ready-green dot + „na żywo" caption (§9.4). Green is the brand accent
 * and only ever means good news / liveness — here it signals the page is live.
 * Pure presentational: no JS shipped.
 */
export function LiveDot({ locale }: { locale: Locale }) {
  const t = createT(locale);
  return (
    <div className="flex items-center justify-center gap-2 text-caption text-ink-soft">
      <span
        aria-hidden
        className="stoliq-livedot inline-block size-2 rounded-pill bg-ready-fill"
      />
      <span>{t('common.live')}</span>
    </div>
  );
}
