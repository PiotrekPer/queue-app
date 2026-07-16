'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@stoliq/core';
import { PhoneE164Schema } from '@stoliq/core';
import { createT } from '@/lib/i18n';
import { submitContact } from '@/lib/guest-data';
import { guestCopy } from './copy';

/**
 * Phone opt-in card (§8, §11). Shown in the waiting state only when the venue is
 * paid + SMS-enabled (can_add_phone) and no phone is on file yet. The guest types
 * their OWN number on their OWN device (cleaner RODO basis). Marketing consent is
 * a SEPARATE, unticked checkbox rendered only if the venue enabled it.
 */
export function PhoneOptIn({
  token,
  locale,
  venueName,
  retentionDays,
  marketingEnabled,
}: {
  token: string;
  locale: Locale;
  venueName: string;
  retentionDays: number;
  marketingEnabled: boolean;
}) {
  const t = createT(locale);
  const c = guestCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [raw, setRaw] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Normalise to E.164 (+48…): keep leading +, strip everything non-digit,
  // and default a bare 9-digit Polish number to +48.
  const e164 = useMemo(() => toE164(raw), [raw]);
  const valid = PhoneE164Schema.safeParse(e164).success;

  const onSubmit = () => {
    setError(null);
    if (!valid) {
      setError(c('phoneError'));
      return;
    }
    startTransition(async () => {
      const res = await submitContact(token, {
        phone_e164: e164,
        marketing_consent: marketing,
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(c('phoneError'));
      }
    });
  };

  if (done) {
    return (
      <div className="rounded-control border border-ink/10 bg-paper-hi p-4 text-center text-small text-ink-soft">
        {c('phoneSaved')}
      </div>
    );
  }

  return (
    <div className="rounded-control border border-ink/10 bg-paper-hi p-4">
      <p className="font-ui text-body font-semibold text-ink">
        {t('guest.phoneOptInTitle')}
      </p>

      <label className="mt-3 block">
        <span className="sr-only">{t('guest.phoneInputLabel')}</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={raw}
          onChange={(e) => setRaw(formatMask(e.target.value))}
          placeholder="+48 600 000 000"
          aria-label={t('guest.phoneInputLabel')}
          aria-invalid={error != null}
          className="nums w-full rounded-control border border-ink/20 bg-paper px-4 py-3 font-mono text-body text-ink outline-none focus:border-ready-fill"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-2 text-small text-danger-paper">
          {error}
        </p>
      ) : null}

      <p className="mt-2 text-caption text-ink-soft">
        {t('guest.phoneConsent', { retention: retentionDays })}
      </p>

      {marketingEnabled ? (
        <label className="mt-3 flex items-start gap-2 text-caption text-ink-soft">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-ready-fill)]"
          />
          <span>
            {t('guest.marketingConsent', { venue: venueName })}{' '}
            <span className="opacity-70">{c('marketingOptional')}</span>
          </span>
        </label>
      ) : null}

      <button
        type="button"
        disabled={pending || !valid}
        onClick={onSubmit}
        className="mt-4 min-h-[48px] w-full rounded-control bg-ready-fill px-5 font-ui text-body font-semibold text-paper-hi transition-opacity disabled:opacity-50"
      >
        {pending ? c('phoneSubmitting') : c('phoneSubmit')}
      </button>
    </div>
  );
}

/** Light display mask: keep a single leading +, spaces every 3 digits. */
function formatMask(input: string): string {
  const hasPlus = input.trimStart().startsWith('+');
  const digits = input.replace(/\D/g, '');
  const grouped = digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return (hasPlus ? '+' : '') + grouped;
}

/** Coerce masked input to strict E.164 for validation/submit (+48 default). */
function toE164(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 9) return '+48' + digits; // bare Polish mobile
  if (digits.startsWith('48')) return '+' + digits;
  return digits ? '+' + digits : '';
}
