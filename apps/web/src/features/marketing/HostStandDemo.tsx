'use client';

/**
 * The playable mini host-stand (§10 hero). One interaction explains the whole
 * product: tap „Powiadom" on „Ania · 4 os." and the guest numerek beside it
 * flips to the green STOLIK GOTOWY stamp in realtime — the product's single
 * theatrical moment (§9.1/§9.4). Fully client-side, keyboard accessible,
 * ~one boolean of state. Fires `demo_played` once (no-op without a PostHog key).
 */
import { useState } from 'react';
import type { Locale } from '@stoliq/core';
import { capture } from './analytics';
import { marketingCopy } from './copy';

export function HostStandDemo({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).hero.demo;
  const [notified, setNotified] = useState(false);

  function notify() {
    if (notified) return;
    setNotified(true);
    capture('demo_played');
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:justify-center">
      {/* Staff phone — the dark „service-bar instrument" (§9.1) */}
      <div
        className="w-full max-w-[280px] rounded-[32px] border border-ink/10 bg-espresso p-3 shadow-2xl shadow-ink/20"
        aria-label={c.queueHeader}
      >
        <div className="rounded-[24px] bg-espresso p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-caption font-medium text-smoke">{c.queueHeader}</span>
            <span className="nums rounded-pill bg-walnut px-2.5 py-1 font-mono text-caption text-steam">
              3
            </span>
          </div>

          <ul className="flex flex-col gap-2.5">
            {c.cards.map((card, i) => {
              const isAnia = i === 0;
              const done = isAnia && notified;
              return (
                <li
                  key={card.name}
                  className={`flex items-center gap-3 overflow-hidden rounded-control border-l-[3px] bg-walnut py-2.5 pl-2.5 pr-2 transition-colors ${
                    done ? 'border-l-ready-dark' : 'border-l-waiting-dark'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-semibold text-steam">
                      {card.name} <span className="text-smoke">· {card.meta}</span>
                    </p>
                    <p
                      className={`text-caption ${done ? 'text-ready-dark' : 'text-waiting-dark'}`}
                    >
                      {done ? c.ready : c.positionCaption}
                    </p>
                  </div>
                  {isAnia ? (
                    <button
                      type="button"
                      onClick={notify}
                      disabled={notified}
                      className={`shrink-0 rounded-control px-3 py-2 text-caption font-semibold transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steam ${
                        done
                          ? 'bg-walnut-hi text-smoke'
                          : 'bg-ready-fill text-paper-hi hover:scale-[1.03]'
                      }`}
                    >
                      {done ? '✓' : c.notify}
                    </button>
                  ) : (
                    <span className="shrink-0 px-1 font-mono text-caption text-smoke" aria-hidden>
                      Nr {47 + i}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-center text-caption text-smoke" aria-live="polite">
            {notified ? c.ready : c.hint}
          </p>
        </div>
      </div>

      {/* Guest numerek — the paper ticket (§9.4) */}
      <div
        className="w-full max-w-[240px] rounded-ticket border border-ink/10 bg-paper-hi p-6 shadow-xl shadow-ink/10"
        aria-label={c.guestHeader}
      >
        <div className="perforated-top -mx-6 -mt-6 mb-5 h-3" aria-hidden />
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Numerek 47
        </p>

        {notified ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="stamp-in -rotate-3 rounded-control bg-ready-fill px-4 py-3">
              <span className="font-display text-[22px] font-extrabold leading-tight text-paper-hi">
                {c.ready}
              </span>
            </div>
            <p className="mt-5 text-small text-ink-soft">{c.readyHold}</p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center">
            <span className="nums font-mono text-[64px] font-semibold leading-none text-ink">
              {c.position}
            </span>
            <span className="mt-1 text-caption text-ink-soft">{c.positionCaption}</span>
            <p className="mt-4 text-small text-ink-soft">{c.waiting}</p>
            <span className="mt-3 flex items-center gap-1.5 text-caption text-ink-soft">
              <span className="live-dot h-2 w-2 rounded-full bg-ready-paper" aria-hidden />
              {c.live}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
