import type { Party } from '../types';
import { formatDuration } from '../lib/formatDuration';
import { clearTable, tabTotal } from '../lib/queueStore';

export default function TableCard({ party, now }: { party: Party; now: number }) {
  const seatedFor = party.seatedAt ? formatDuration(party.seatedAt, now) : '';
  const total = tabTotal(party);

  return (
    <div className="table-card">
      <div className="table-card-header">
        <span className="ticket-number">#{party.ticketNumber}</span>
        <span className="table-card-time">{seatedFor}</span>
      </div>
      <p className="table-card-name">{party.name}</p>
      <p className="muted">
        {party.partySize} {party.partySize === 1 ? 'guest' : 'guests'}
      </p>
      {total > 0 && <p className="tab-badge">Tab: ${total.toFixed(2)}</p>}
      <button className="secondary" onClick={() => clearTable(party.id)}>
        Clear table
      </button>
    </div>
  );
}
