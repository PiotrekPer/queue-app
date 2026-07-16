/**
 * Section shell — consistent vertical rhythm + max width for the landing.
 * Generous whitespace, calm (§10 principle: one bold moment per surface).
 */
export function Section({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`px-5 py-16 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

/** Quiet section heading (Bricolage), left-aligned by default. */
export function SectionHeading({
  kicker,
  children,
  className = '',
}: {
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {kicker ? (
        <p className="mb-3 font-mono text-caption uppercase tracking-[0.12em] text-ink-soft">
          {kicker}
        </p>
      ) : null}
      <h2 className="font-display text-h2 font-bold leading-tight text-ink sm:text-[32px]">
        {children}
      </h2>
    </div>
  );
}
