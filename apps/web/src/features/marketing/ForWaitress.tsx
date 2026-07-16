import type { Locale } from '@stoliq/core';
import { marketingCopy } from './copy';

/**
 * Section 4 — Dla kelnerki, nie dla informatyka (§10). The ONLY dark section:
 * the app's espresso world intrudes. Contrast makes both worlds legible.
 * A rail of stylised app-screen mockups + the multi-device sync line.
 */
export function ForWaitress({ locale }: { locale: Locale }) {
  const c = marketingCopy(locale).forWaitress;

  return (
    <section className="bg-espresso px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-caption uppercase tracking-[0.12em] text-smoke">{c.kicker}</p>
        <h2 className="mt-3 max-w-2xl font-display text-h2 font-bold leading-tight text-steam sm:text-[32px]">
          {c.heading}
        </h2>
        <p className="mt-4 max-w-xl text-body text-smoke">{c.sub}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {c.screens.map((s) => (
            <div
              key={s.title}
              className="rounded-card border border-hairline bg-walnut p-5"
            >
              {/* stylised screen — a few walnut bars nodding at the Kolejka rail */}
              <div className="flex items-center justify-between">
                <span className="text-small font-semibold text-steam">{s.title}</span>
                <span className="nums rounded-pill bg-walnut-hi px-2 py-0.5 font-mono text-caption text-smoke">
                  6
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="h-8 rounded-control border-l-[3px] border-l-waiting-dark bg-walnut-hi" />
                <div className="h-8 rounded-control border-l-[3px] border-l-notified-dark bg-walnut-hi" />
                <div className="h-8 rounded-control border-l-[3px] border-l-ready-dark bg-walnut-hi" />
              </div>
              <p className="mt-4 text-caption text-smoke">{s.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
