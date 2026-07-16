/**
 * The Stoliq wordmark — quiet type + a mono „numerek" chip nodding at the
 * ticket motif (§9.1 signature element). Not theatrical: the one bold moment
 * is the hero demo, so the mark stays calm.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-display text-[19px] font-extrabold leading-none tracking-tight">
        Stoliq
      </span>
      <span className="nums rounded-[6px] bg-ready-fill px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-paper-hi">
        47
      </span>
    </span>
  );
}
