import { NextResponse } from 'next/server';
import { fetchTicket } from '@/lib/guest-data';
import { buildSaveUrl, googlePassConfigured } from '@/lib/google-pass';
import type { PassModel } from '@stoliq/core';

/**
 * `GET /wallet/{token}?platform=google` → `{ saveUrl }`
 *
 * The guest page's Add-to-Wallet endpoint, mirroring how `/a/[token]` fronts the
 * guest-action edge function: the browser only ever talks to our own origin, and
 * the signing key stays server-side.
 *
 * Apple is not served here — a `.pkpass` needs the Pass Type ID certificate
 * (docs/specs §9), so the UI doesn't offer the button until that exists.
 */
export const dynamic = 'force-dynamic';
// Signing uses node:crypto — not available on the edge runtime.
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const platform = new URL(req.url).searchParams.get('platform');

  if (platform !== 'google') {
    return NextResponse.json(
      { error: 'unsupported_platform', code: 'unsupported_platform' },
      { status: 400 },
    );
  }
  if (!googlePassConfigured()) {
    return NextResponse.json(
      { error: 'wallet not configured', code: 'not_configured' },
      { status: 501 },
    );
  }

  const ticket = await fetchTicket(token);
  if (!ticket) {
    return NextResponse.json({ error: 'not found', code: 'not_found' }, { status: 404 });
  }
  // A finished visit has nothing to carry in a wallet.
  if (ticket.status !== 'waiting' && ticket.status !== 'notified' && ticket.status !== 'on_way') {
    return NextResponse.json(
      { error: 'visit has ended', code: 'invalid_transition' },
      { status: 409 },
    );
  }

  const model: PassModel = {
    serial: token,
    venueName: ticket.venue_name,
    ticketNo: ticket.ticket_no,
    status: ticket.status,
    position: ticket.position,
    ticketUrl: new URL(`/v/${token}`, req.url).toString(),
    locale: ticket.locale,
  };

  const saveUrl = buildSaveUrl(model);
  if (!saveUrl) {
    return NextResponse.json({ error: 'signing failed', code: 'sign_failed' }, { status: 500 });
  }

  return NextResponse.json({ saveUrl }, { headers: { 'cache-control': 'no-store' } });
}
