import type { Locale } from '@stoliq/core';
import { formatWarsawTime } from '@stoliq/core';
import { createT } from '@/lib/i18n';

/**
 * The product's ONE theatrical moment (§9.1, §9.4): the STOLIK GOTOWY stamp.
 * Rotated -3°, ready-fill fill, paper text, entering once with motion.stamp
 * (scale/rotate; collapses to a crossfade under prefers-reduced-motion via
 * guest.css). Replaces the position block in the notified state. Below it, the
 * hold deadline as plain text — never a live countdown (§6).
 */
export function Stamp({
  locale,
  holdExpiresAt,
}: {
  locale: Locale;
  holdExpiresAt: string | null;
}) {
  const t = createT(locale);
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="stoliq-stamp stoliq-stamp-fade select-none rounded-ticket bg-ready-fill px-6 py-4 text-ready-paper shadow-sm"
        role="status"
        aria-label={t('guest.ready')}
      >
        <span className="block font-display text-h2 font-extrabold uppercase tracking-wide text-paper-hi">
          {t('guest.ready')}
        </span>
      </div>
      {holdExpiresAt ? (
        <p className="text-body text-ink">
          {t('guest.ready_hold', { time: formatWarsawTime(holdExpiresAt) })}
        </p>
      ) : null}
    </div>
  );
}
