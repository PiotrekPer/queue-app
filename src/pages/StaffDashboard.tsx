import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useQueue } from '../lib/useQueue';
import {
  addParty,
  callParty,
  cancelParty,
  openTab,
  removeParty,
  seatParty,
  tabTotal,
} from '../lib/queueStore';
import type { Party } from '../types';
import TabPanel from '../components/TabPanel';
import TableCard from '../components/TableCard';

export default function StaffDashboard() {
  const parties = useQueue();
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [phone, setPhone] = useState('');
  const [lastTicket, setLastTicket] = useState<Party | null>(null);
  const [openTabId, setOpenTabId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const waiting = useMemo(
    () =>
      parties
        .filter((p) => p.status === 'waiting')
        .sort((a, b) => a.joinedAt - b.joinedAt),
    [parties]
  );
  const called = useMemo(
    () =>
      parties
        .filter((p) => p.status === 'called')
        .sort((a, b) => (a.calledAt ?? 0) - (b.calledAt ?? 0)),
    [parties]
  );
  const seated = useMemo(
    () =>
      parties
        .filter((p) => p.status === 'seated')
        .sort((a, b) => (a.seatedAt ?? 0) - (b.seatedAt ?? 0)),
    [parties]
  );

  function ticketUrl(ticketNumber: number) {
    return `${window.location.origin}/status?ticket=${ticketNumber}`;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    const party = await addParty(name.trim(), partySize, phone.trim());
    setLastTicket(party);
    setName('');
    setPhone('');
    setPartySize(2);
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Host Dashboard</h1>
        <p className="subtitle">Manage the entrance queue</p>
      </header>

      <div className="main-col">
        <section className="card">
          <h2>Add party to queue</h2>
          <form className="add-form" onSubmit={handleAdd}>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Smith"
                required
              />
            </label>
            <label>
              Party size
              <input
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Phone number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="555-0100"
                required
              />
            </label>
            <button type="submit">Add to queue</button>
          </form>
        </section>

        {called.length > 0 && (
          <section className="card called-card">
            <h2>Called &mdash; waiting to be seated</h2>
            <ul className="party-list">
              {called.map((p) => (
                <li key={p.id} className="party-row">
                  <div className="party-info">
                    <span className="ticket-number">#{p.ticketNumber}</span>
                    <span>{p.name}</span>
                    <span className="muted">party of {p.partySize}</span>
                  </div>
                  <div className="actions">
                    <button onClick={() => seatParty(p.id)}>Seat</button>
                    <button
                      className="secondary"
                      onClick={() => cancelParty(p.id)}
                    >
                      No-show
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>Waiting ({waiting.length})</h2>
          {waiting.length === 0 ? (
            <p className="muted">No one is waiting.</p>
          ) : (
            <ul className="party-list">
              {waiting.map((p, i) => (
                <li key={p.id} className="party-row-wrap">
                  <div className="party-row">
                    <div className="party-info">
                      <span className="position">{i + 1}</span>
                      <span className="ticket-number">#{p.ticketNumber}</span>
                      <span>{p.name}</span>
                      <span className="muted">party of {p.partySize}</span>
                      {p.tab && (
                        <span className="tab-badge">
                          Tab: ${tabTotal(p).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="actions">
                      {p.tab ? (
                        <button
                          className="secondary"
                          onClick={() =>
                            setOpenTabId(openTabId === p.id ? null : p.id)
                          }
                        >
                          {openTabId === p.id ? 'Hide tab' : 'View tab'}
                        </button>
                      ) : (
                        <button
                          className="secondary"
                          onClick={() => {
                            openTab(p);
                            setOpenTabId(p.id);
                          }}
                        >
                          Open tab
                        </button>
                      )}
                      <button onClick={() => callParty(p.id)}>Call</button>
                      <button
                        className="secondary"
                        onClick={() => removeParty(p.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {openTabId === p.id && <TabPanel party={p} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Currently at tables ({seated.length})</h2>
          {seated.length === 0 ? (
            <p className="muted">No tables currently seated.</p>
          ) : (
            <div className="tables-grid">
              {seated.map((p) => (
                <TableCard key={p.id} party={p} now={now} />
              ))}
            </div>
          )}
        </section>
      </div>

      {lastTicket && (
        <div className="ticket-overlay" onClick={() => setLastTicket(null)}>
          <div
            className="ticket-overlay-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ticket-overlay-close"
              onClick={() => setLastTicket(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <p className="ticket-overlay-number">#{lastTicket.ticketNumber}</p>
            <p className="ticket-overlay-name">
              {lastTicket.name} &middot; party of {lastTicket.partySize}
            </p>
            <QRCodeSVG value={ticketUrl(lastTicket.ticketNumber)} size={320} />
            <p className="muted">Scan this code to track your spot in line.</p>
          </div>
        </div>
      )}
    </div>
  );
}
