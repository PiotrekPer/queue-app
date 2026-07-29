import { NextResponse } from 'next/server';
import {
  GUEST_ACTIONS,
  GuestActionInputSchema,
  GuestContactInputSchema,
  PushSubscribeInputSchema,
  type GuestAction,
} from '@stoliq/core';
import { env, hasBackend } from '@/lib/env';

/**
 * Guest mutation endpoint — `/a/{token}` (§7.3, §8). The ticket page POSTs here;
 * we validate, then proxy to the `guest-action` edge function which does the
 * token lookup + service_role write (guests have no direct table access, §4.2).
 * Two intents:
 *   { kind: 'action', action }                    → state transition
 *   { kind: 'contact', phone_e164, marketing... }  → set guest contact
 * Without a backend we simulate success so the client optimistic flow works in
 * dev. Invalid transitions surface as 409 so the client rolls back (§8).
 */

export const dynamic = 'force-dynamic';

type ActionPayload = { kind: 'action'; action: GuestAction };
type ContactPayload = {
  kind: 'contact';
  phone_e164?: string;
  marketing_consent?: boolean;
};
type PushPayload = {
  kind: 'push';
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400 });
  }

  const kind = (raw as { kind?: unknown })?.kind;

  if (kind === 'action') {
    return handleAction(token, raw as ActionPayload);
  }
  if (kind === 'contact') {
    return handleContact(token, raw as ContactPayload);
  }
  if (kind === 'push') {
    return handlePush(token, raw as PushPayload);
  }
  return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400 });
}

// ─── state action → guest-action edge fn ──────────────────────────────────────

async function handleAction(token: string, body: ActionPayload) {
  const action = body.action;
  if (!GUEST_ACTIONS.includes(action as GuestAction)) {
    return NextResponse.json({ ok: false, code: 'invalid_action' }, { status: 400 });
  }

  const parsed = GuestActionInputSchema.safeParse({ token, action });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid_action' }, { status: 400 });
  }

  if (!hasBackend) {
    // Dev/CI: pretend the transition succeeded (state 6 tokens still 404-able
    // is handled by the read path, not here).
    return NextResponse.json({ ok: true, simulated: true });
  }

  return proxy(`${env.functionsUrl}/guest-action`, parsed.data);
}

// ─── contact submission → guest-action edge fn (set-contact) ──────────────────

async function handleContact(token: string, body: ContactPayload) {
  const parsed = GuestContactInputSchema.safeParse({
    token,
    phone_e164: body.phone_e164,
    marketing_consent: body.marketing_consent ?? false,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid_contact' }, { status: 400 });
  }

  if (!hasBackend) {
    return NextResponse.json({ ok: true, simulated: true });
  }

  // The edge function distinguishes contact from action by the payload shape.
  return proxy(`${env.functionsUrl}/guest-action`, {
    intent: 'set_contact',
    ...parsed.data,
  });
}

// ─── push-subscribe → guest-action edge fn ────────────────────────────────────

async function handlePush(token: string, body: PushPayload) {
  const parsed = PushSubscribeInputSchema.safeParse({
    token,
    subscription: body.subscription,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid_subscription' }, { status: 400 });
  }

  if (!hasBackend) {
    return NextResponse.json({ ok: true, simulated: true });
  }

  // guest-action distinguishes push by the `subscription` field in the body.
  return proxy(`${env.functionsUrl}/guest-action`, parsed.data);
}

// ─── shared proxy (server-side; anon key, never service_role) ─────────────────

async function proxy(url: string, payload: unknown) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    let code: string | undefined;
    try {
      const json = (await res.json()) as { code?: string };
      code = json?.code;
    } catch {
      // non-JSON response — ignore
    }

    // Pass 409 through verbatim so the client rolls back optimistic UI (§8).
    return NextResponse.json(
      { ok: res.ok, code: code ?? (res.ok ? undefined : 'upstream_error') },
      { status: res.status },
    );
  } catch {
    return NextResponse.json({ ok: false, code: 'network_error' }, { status: 502 });
  }
}
