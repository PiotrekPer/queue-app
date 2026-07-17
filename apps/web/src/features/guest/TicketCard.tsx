import type { Locale, TicketView } from '@stoliq/core';
import { elapsedMinutes, liveWait } from '@stoliq/core';
import { createT } from '@/lib/i18n';
import { guestCopy } from './copy';
import { LiveDot } from './LiveDot';
import { Stamp } from './Stamp';
import { GuestActions } from './GuestActions';
import { PhoneOptIn } from './PhoneOptIn';
import { AddToWallet } from './AddToWallet';

/**
 * The numerek (§9.4). Paper ticket card with a perforated top edge, rendered
 * server-side. Branches on the visit status into the 6 exhaustive guest states
 * (§8). Only the notified state animates (the Stamp) — everything else is calm.
 * Pass token = null to render state 6 (unknown/expired ticket).
 */
export function TicketCard({
  ticket,
  token,
}: {
  ticket: TicketView | null;
  token: string;
}) {
  // State 6: unknown / expired token — the "404 ticket".
  if (!ticket) {
    return (
      <Shell>
        <NotFoundBody locale="pl" />
      </Shell>
    );
  }

  const locale = ticket.locale;
  const t = createT(locale);
  const c = guestCopy(locale);

  return (
    <Shell>
      {/* Header: venue + numerek caption — shared by every non-terminal state. */}
      <header className="text-center">
        <h1 className="font-display text-h2 font-bold text-ink">{ticket.venue_name}</h1>
        <p className="mt-1 text-caption uppercase tracking-[0.08em] text-ink-soft nums">
          {t('common.appName')} · {t('common.ticketNo', { n: ticket.ticket_no })}
        </p>
      </header>

      <Body ticket={ticket} token={token} locale={locale} />

      <footer className="mt-8 border-t border-ink/10 pt-4 text-center text-caption text-ink-soft">
        {t('guest.footer', { retention: ticket.retention_days })}
        <span className="mt-1 block opacity-70">{c('liveRefresh')}</span>
      </footer>
    </Shell>
  );
}

// ─── per-state bodies ─────────────────────────────────────────────────────────

function Body({
  ticket,
  token,
  locale,
}: {
  ticket: TicketView;
  token: string;
  locale: Locale;
}) {
  const t = createT(locale);
  const c = guestCopy(locale);

  switch (ticket.status) {
    // State 1: waiting — the ticket + optional phone opt-in.
    case 'waiting': {
      const showOptIn = ticket.can_add_phone && !ticket.has_phone;
      return (
        <div className="mt-6 flex flex-col gap-6">
          <Position ticket={ticket} locale={locale} />
          <WaitLine ticket={ticket} locale={locale} />
          <LiveDot locale={locale} />
          {ticket.can_add_wallet ? (
            <AddToWallet token={token} locale={locale} />
          ) : null}
          {showOptIn ? (
            <PhoneOptIn
              token={token}
              locale={locale}
              venueName={ticket.venue_name}
              retentionDays={ticket.retention_days}
              marketingEnabled={ticket.marketing_enabled}
            />
          ) : null}
        </div>
      );
    }

    // State 2: notified — the STOLIK GOTOWY stamp + guest actions.
    case 'notified':
      return (
        <div className="mt-6 flex flex-col gap-8">
          <Stamp locale={locale} holdExpiresAt={ticket.hold_expires_at} />
          <GuestActions token={token} locale={locale} />
          <LiveDot locale={locale} />
        </div>
      );

    // State 3: on_way — reassurance.
    case 'on_way':
      return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-h2 font-bold text-ink">
            {t('guest.onWayTitle')}
          </p>
          <p className="text-body text-ink-soft">{c('onWayAddressHint')}</p>
          <div className="mt-2">
            <LiveDot locale={locale} />
          </div>
        </div>
      );

    // State 4: seated — smacznego, page self-archives (no more polling needed).
    case 'seated':
      return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-h1 font-bold text-ink">
            {t('guest.seatedTitle')}
          </p>
        </div>
      );

    // State 5: terminal ended (guest_cancelled / no_show / staff_removed).
    case 'guest_cancelled':
    case 'no_show':
    case 'staff_removed':
      return (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <p className="font-ui text-body font-semibold text-neutral-end">
            {t('guest.endedTitle')}
          </p>
          <p className="text-small text-ink-soft">{t('guest.endedRejoin')}</p>
        </div>
      );

    default:
      return null;
  }
}

/** THE element (§9.4): giant tabular-mono position with its caption. */
function Position({ ticket, locale }: { ticket: TicketView; locale: Locale }) {
  const t = createT(locale);
  const pos = ticket.position;
  return (
    <div className="flex flex-col items-center">
      <span className="nums font-mono text-position font-semibold leading-none text-ink">
        {pos != null ? `${pos}.` : '—'}
      </span>
      <span className="mt-2 text-body text-ink-soft">{t('guest.positionCaption')}</span>
    </div>
  );
}

/** Live wait line (§6): „ok. 20 min" / „już za chwilę" / overdue apology. */
function WaitLine({ ticket, locale }: { ticket: TicketView; locale: Locale }) {
  const t = createT(locale);
  const elapsed = elapsedMinutes(ticket.created_at, new Date().toISOString());
  const w = liveWait(ticket.quote_minutes, elapsed);

  let text: string;
  if (w.kind === 'exact' && w.minutes != null) {
    text = t('guest.aboutMinutes', { min: w.minutes });
  } else if (w.kind === 'soon') {
    text = t('guest.soon');
  } else {
    text = t('guest.overdue');
  }

  return <p className="text-center text-body text-ink nums">{text}</p>;
}

function NotFoundBody({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const c = guestCopy(locale);
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="nums font-mono text-ticket-no font-semibold text-ink-soft">?</span>
      <p className="font-display text-h2 font-bold text-ink">{t('guest.notFoundTitle')}</p>
      <p className="text-small text-ink-soft">{c('notFoundHint')}</p>
    </div>
  );
}

// ─── the paper ticket shell (perforated top, 1px ink border) ──────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="perforated-top rounded-ticket border border-ink/10 bg-paper-hi p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
