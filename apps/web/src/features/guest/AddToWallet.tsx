'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@stoliq/core';
import { guestCopy } from './copy';

/**
 * "Dodaj do Apple/Google Wallet" (docs/specs/push-notifications.md, Phase B).
 *
 * The zero-install path to a lock-screen "STOLIK GOTOWY": a wallet pass is not
 * an app, so it keeps the guest contract (§1) intact — unlike web push, which on
 * iOS would demand an Add-to-Home-Screen install. Free on every tier: the pass
 * update costs nothing, so free-tier venues get the moment too.
 *
 * Renders exactly ONE button — the one that fits the device (§9: one bold moment
 * per surface). Desktop and unknown platforms get nothing rather than a button
 * that can't work.
 */
type Platform = 'apple' | 'google' | null;

/** Detect on the client only — the server can't know, and UA sniffing must not SSR. */
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac, so also treat a touch-capable Mac as iOS.
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIos) return 'apple';
  if (/Android/i.test(ua)) return 'google';
  return null;
}

export function AddToWallet({ token, locale }: { token: string; locale: Locale }) {
  const c = guestCopy(locale);
  const [platform, setPlatform] = useState<Platform>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPlatform(detectPlatform()), []);

  // Nothing sensible to offer (desktop / unknown) → render nothing.
  if (!platform) return null;

  // Same-origin route (mirrors `/a/[token]`): the signing key never leaves the
  // server. Google is signed in-app; Apple is signed by the notifier and streamed
  // back as a .pkpass, so the two flows differ below.
  const isApple = platform === 'apple';
  const passUrl = `/wallet/${encodeURIComponent(token)}?platform=${isApple ? 'apple' : 'google'}`;

  const onSave = async () => {
    setError(null);
    setPending(true);
    try {
      if (isApple) {
        // iOS opens the "Add to Wallet" sheet on a top-level navigation to an
        // http(s) URL whose response is application/vnd.apple.pkpass — a blob:
        // URL does NOT trigger it. Navigate straight to the same-origin route.
        window.location.href = passUrl;
        return;
      }
      // Google: fetch the signed save-JWT first, then hand off to Google.
      const res = await fetch(passUrl, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('issue_failed');
      const { saveUrl } = (await res.json()) as { saveUrl?: string };
      if (!saveUrl) throw new Error('no_save_url');
      window.location.href = saveUrl;
    } catch {
      setError(c('walletError'));
      setPending(false);
    }
  };

  return (
    <WalletCard locale={locale}>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="flex min-h-[48px] w-full items-center justify-center rounded-control bg-ink px-5 font-ui text-body font-semibold text-paper-hi transition-opacity disabled:opacity-50"
      >
        {pending ? c('walletAdding') : isApple ? c('walletApple') : c('walletGoogle')}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-small text-danger-paper">
          {error}
        </p>
      ) : null}
    </WalletCard>
  );
}

function WalletCard({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const c = guestCopy(locale);
  return (
    <div className="rounded-control border border-ink/10 bg-paper-hi p-4">
      <p className="font-ui text-body font-semibold text-ink">{c('walletTitle')}</p>
      <p className="mt-1 text-caption text-ink-soft">{c('walletHint')}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
