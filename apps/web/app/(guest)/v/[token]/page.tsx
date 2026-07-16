import type { Metadata } from 'next';
import { fetchTicket } from '@/lib/guest-data';
import { TicketCard } from '@/features/guest/TicketCard';
import { Poller } from '@/features/guest/Poller';

/**
 * Guest ticket page — `/v/{token}` (§8). Server-rendered per request, then kept
 * live by <Poller/> (8s + on visibility). Reads the public TicketView via the
 * `get-ticket` edge function (or a deterministic mock without a backend).
 */

// Always render fresh: the ticket state changes out-of-band (staff actions).
export const dynamic = 'force-dynamic';

type Params = { token: string };

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TicketPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const ticket = await fetchTicket(token);

  // Stop polling once the visit is terminal (page self-archives, §8 states 4/5).
  const isTerminal =
    ticket != null &&
    (ticket.status === 'seated' ||
      ticket.status === 'guest_cancelled' ||
      ticket.status === 'no_show' ||
      ticket.status === 'staff_removed');

  return (
    <>
      <TicketCard ticket={ticket} token={token} />
      {ticket && !isTerminal ? <Poller token={token} /> : null}
    </>
  );
}
