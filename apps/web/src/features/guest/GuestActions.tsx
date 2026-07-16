'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GuestAction, Locale } from '@stoliq/core';
import { createT } from '@/lib/i18n';
import { postGuestAction } from '@/lib/guest-data';
import { guestCopy } from './copy';

/**
 * Guest action buttons for the notified state (§7.3, §8):
 *   Już idziemy (on_my_way, primary ready-fill) · +5 minut (delay_5, outline,
 *   max 2 uses) · Rezygnujemy (cancel, ghost danger → confirm sheet).
 * All optimistic: we refresh on success, and on a 409 invalid_transition we
 * surface a gentle error and let the next poll reconcile truth (§8).
 */
export function GuestActions({
  token,
  locale,
}: {
  token: string;
  locale: Locale;
}) {
  const t = createT(locale);
  const c = guestCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayUses, setDelayUses] = useState(0);

  const run = (action: GuestAction) => {
    setError(null);
    startTransition(async () => {
      const res = await postGuestAction(token, action);
      if (res.ok) {
        if (action === 'delay_5') setDelayUses((n) => n + 1);
        router.refresh();
      } else {
        // 409 (invalid_transition) or network — show fact + fix, then let the
        // 8s poll reconcile the real state.
        setError(c('actionError'));
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-small text-danger-paper">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => run('on_my_way')}
        className="min-h-[56px] rounded-control bg-ready-fill px-5 font-ui text-body font-semibold text-paper-hi transition-opacity disabled:opacity-60"
      >
        {t('guest.actionOnWay')}
      </button>

      <button
        type="button"
        disabled={pending || delayUses >= 2}
        onClick={() => run('delay_5')}
        className="min-h-[48px] rounded-control border border-ink/20 px-5 font-ui text-body font-medium text-ink transition-opacity disabled:opacity-40"
      >
        {t('guest.actionDelay')}
      </button>

      {!confirming ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          className="min-h-[48px] rounded-control px-5 font-ui text-body font-medium text-danger-paper transition-opacity disabled:opacity-40"
        >
          {t('guest.actionCancel')}
        </button>
      ) : (
        <div className="rounded-control border border-danger-paper/30 bg-paper-hi p-4">
          <p className="font-ui text-body font-semibold text-ink">
            {t('guest.cancelConfirmTitle')}
          </p>
          <p className="mt-1 text-small text-ink-soft">
            {t('guest.cancelConfirmBody')}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="min-h-[48px] flex-1 rounded-control border border-ink/20 px-4 font-ui text-body font-medium text-ink disabled:opacity-40"
            >
              {c('cancelKeep')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run('cancel')}
              className="min-h-[48px] flex-1 rounded-control bg-danger-paper px-4 font-ui text-body font-semibold text-paper-hi disabled:opacity-60"
            >
              {c('cancelConfirmCta')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
