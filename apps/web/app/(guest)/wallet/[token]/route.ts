import { NextResponse } from 'next/server';
import { env, hasBackend } from '@/lib/env';
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

  // Apple .pkpass is signed by the notifier (the Pass Type cert lives there, not
  // in the web bundle) — proxy it same-origin below.
  if (platform === 'apple') {
    return issueApplePkpass(token);
  }
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

/**
 * Apple `.pkpass` — signed by the notifier's `issue-pass` (Deno) because the Pass
 * Type ID cert is a server secret held there. We proxy it and stream the pass
 * back on our own origin, mirroring how `/a/[token]` fronts guest-action.
 */
async function issueApplePkpass(token: string): Promise<Response> {
  if (!hasBackend) {
    return NextResponse.json(
      { error: 'apple wallet needs the notifier backend', code: 'not_configured' },
      { status: 501 },
    );
  }
  const upstream = await fetch(
    `${env.functionsUrl}/issue-pass?token=${encodeURIComponent(token)}&platform=apple`,
    { cache: 'no-store', headers: { authorization: `Bearer ${env.supabaseAnonKey}` } },
  );
  if (!upstream.ok) {
    // Bubble the edge status + JSON (501 not_configured, 404, 409 ended).
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  }
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.apple.pkpass',
      // inline (not attachment) so Safari hands the pass to PassKit rather than
      // downloading it.
      'content-disposition': `inline; filename="numerek-${token}.pkpass"`,
      'cache-control': 'no-store',
    },
  });
}
