import { Section } from './Section';

/** Compact page hero for sub-pages (/cennik, /rodo, /kontakt). */
export function PageIntro({
  kicker,
  title,
  sub,
}: {
  kicker?: string;
  title: string;
  sub?: string;
}) {
  return (
    <Section className="pb-4 pt-14 sm:pt-16">
      {kicker ? (
        <p className="mb-3 font-mono text-caption uppercase tracking-[0.12em] text-ink-soft">
          {kicker}
        </p>
      ) : null}
      <h1 className="max-w-2xl font-display text-h1 font-extrabold leading-[1.05] text-ink">
        {title}
      </h1>
      {sub ? <p className="mt-4 max-w-xl text-body text-ink-soft">{sub}</p> : null}
    </Section>
  );
}
