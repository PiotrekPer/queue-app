import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueue } from '../lib/useQueue';
import { findByTicketNumber, waitingAheadOf } from '../lib/queueStore';

export default function StatusPage() {
  const parties = useQueue();
  const [searchParams] = useSearchParams();
  const ticketFromUrl = searchParams.get('ticket');

  const [ticketInput, setTicketInput] = useState(ticketFromUrl ?? '');
  const [lookedUp, setLookedUp] = useState<number | null>(
    ticketFromUrl ? Number(ticketFromUrl) : null
  );

  useEffect(() => {
    if (ticketFromUrl) {
      setTicketInput(ticketFromUrl);
      setLookedUp(Number(ticketFromUrl));
    }
  }, [ticketFromUrl]);

  const waitingCount = useMemo(
    () => parties.filter((p) => p.status === 'waiting').length,
    [parties]
  );

  const party =
    lookedUp !== null ? findByTicketNumber(parties, lookedUp) : undefined;
  const ahead = party ? waitingAheadOf(parties, party) : null;

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(ticketInput);
    if (!Number.isFinite(n) || n <= 0) return;
    setLookedUp(n);
  }

  return (
    <div className="page status-page">
      <header className="page-header">
        <h1>Queue Status</h1>
        <p className="subtitle">
          {waitingCount} {waitingCount === 1 ? 'party' : 'parties'} currently
          waiting
        </p>
      </header>

      <section className="card">
        <h2>Check your position</h2>
        <form className="add-form" onSubmit={handleLookup}>
          <label>
            Your ticket number
            <input
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              placeholder="e.g. 12"
              inputMode="numeric"
              required
            />
          </label>
          <button type="submit">Check status</button>
        </form>

        {lookedUp !== null && (
          <div className="lookup-result">
            {!party ? (
              <p className="muted">No ticket #{lookedUp} found.</p>
            ) : party.status === 'waiting' ? (
              <p>
                You are <strong>#{(ahead ?? 0) + 1}</strong> in line
                {ahead === 0
                  ? ' — you\'re next!'
                  : ` — ${ahead} ${ahead === 1 ? 'party' : 'parties'} ahead of you.`}
              </p>
            ) : party.status === 'called' ? (
              <p className="called-message">
                You've been called! Please head to the host stand.
              </p>
            ) : party.status === 'seated' ? (
              <p className="muted">You're already seated. Enjoy your meal!</p>
            ) : (
              <p className="muted">This ticket is no longer active.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
