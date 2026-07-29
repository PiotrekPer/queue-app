'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@stoliq/core';
import { env } from '@/lib/env';
import { submitPushSubscription } from '@/lib/guest-data';
import { guestCopy } from './copy';

/**
 * Free web-push opt-in (docs/specs/push-notifications.md, Phase A). The zero-cost
 * lock-screen ping for Android/desktop browsers — the one push transport wired
 * end-to-end in the notifier (webpush.ts). Self-hides where it can't work: no
 * VAPID key, no Push API (e.g. a plain iOS Safari tab), permission denied, or
 * already subscribed. On iOS the wallet pass stays the zero-install path (§1).
 */
type State = 'idle' | 'working' | 'done' | 'error';

/** VAPID application server key (urlsafe base64) → the Uint8Array subscribe wants.
 *  Backed by an explicit ArrayBuffer so the type is BufferSource, not the looser
 *  ArrayBufferLike (which could be a SharedArrayBuffer). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function WebPushOptIn({ token, locale }: { token: string; locale: Locale }) {
  const c = guestCopy(locale);
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    const ok =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Notification.permission !== 'denied' &&
      env.vapidPublicKey.length > 0;
    if (!ok) return;
    setSupported(true);
    // Already subscribed on this device → confirm state, don't re-prompt.
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setState('done');
      })
      .catch(() => {});
  }, []);

  if (!supported) return null;

  const onSubscribe = async () => {
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('idle');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
      });
      const { endpoint, keys } = sub.toJSON();
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        setState('error');
        return;
      }
      const res = await submitPushSubscription(token, {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      });
      if (!res.ok) {
        // Don't keep a live browser subscription with no server row — else the
        // next load's getSubscription() would falsely render "notifications on".
        await sub.unsubscribe().catch(() => {});
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="rounded-control border border-ink/10 bg-paper-hi p-4 text-center text-small text-ink-soft">
        {c('pushEnabled')}
      </div>
    );
  }

  return (
    <div className="rounded-control border border-ink/10 bg-paper-hi p-4">
      <p className="font-ui text-body font-semibold text-ink">{c('pushTitle')}</p>
      <p className="mt-1 text-caption text-ink-soft">{c('pushHint')}</p>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={state === 'working'}
        className="mt-3 min-h-[48px] w-full rounded-control border border-ink/20 bg-paper px-5 font-ui text-body font-semibold text-ink transition-opacity disabled:opacity-50"
      >
        {state === 'working' ? c('pushAdding') : c('pushCta')}
      </button>
      {state === 'error' ? (
        <p role="alert" className="mt-2 text-small text-danger-paper">
          {c('pushError')}
        </p>
      ) : null}
    </div>
  );
}
