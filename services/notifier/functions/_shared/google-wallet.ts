/**
 * Google Wallet — issue a Generic pass and patch it on state change
 * (docs/specs/push-notifications.md, Phase B).
 *
 * Simpler than Apple: there is no per-device registration and no APNs. The flow:
 *   1. guest taps "Dodaj do Google Wallet" → we mint a signed "save" JWT and
 *      send them to https://pay.google.com/gp/v/save/{jwt}
 *      → we store one `guest_push_targets` row (kind='google_wallet') holding
 *        the pass object id (wallet_serial). There is no device token.
 *   2. on notify, we PATCH the pass object via the Wallet API; Google fans the
 *      update out to every device that saved it and raises a notification.
 *
 * ── CREDENTIALS (must be provisioned; see §6 of the spec) ────────────────────
 *   GOOGLE_WALLET_ISSUER_ID        numeric issuer id from the Wallet console
 *   GOOGLE_WALLET_SA_EMAIL         service-account email
 *   GOOGLE_WALLET_SA_PRIVATE_KEY   service-account private key (PEM)
 *   GOOGLE_WALLET_CLASS_SUFFIX     shared pass class, e.g. "numerek"
 * Until these exist every entry point degrades to `not_configured` (§1: the
 * guest page just won't offer the button rather than erroring).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGooglePassObject, presentPass, type PassModel } from '@stoliq/core';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
export const SAVE_URL_BASE = 'https://pay.google.com/gp/v/save/';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

// ── Web Crypto RS256 (Deno/Edge — no node:crypto) ────────────────────────────
// The dev twins scripts/wallet-{save-url,update}.ts sign with node:crypto; the
// Edge runtime has only Web Crypto, so we RS256 the same claim sets here.

function b64urlBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlString(s: string): string {
  return b64urlBytes(new TextEncoder().encode(s));
}

/** SA keys arrive with literal `\n` escapes in env; unescape before importing. */
function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  // Explicit ArrayBuffer so the DER is BufferSource (not ArrayBufferLike, which
  // importKey rejects — it could be a SharedArrayBuffer).
  const der = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) der[i] = bin.charCodeAt(i);
  return der;
}

function importSaKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToDer(Deno.env.get('GOOGLE_WALLET_SA_PRIVATE_KEY') ?? ''),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signRs256(claims: Record<string, unknown>, key: CryptoKey): Promise<string> {
  const input = `${b64urlString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlString(
    JSON.stringify(claims),
  )}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${b64urlBytes(new Uint8Array(sig))}`;
}

/** Service-account JWT-bearer grant → OAuth2 access token, cached per instance. */
let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const assertion = await signRs256(
    {
      iss: Deno.env.get('GOOGLE_WALLET_SA_EMAIL') ?? '',
      scope: SCOPE,
      aud: TOKEN_URI,
      iat: now,
      exp: now + 3600,
    },
    await importSaKey(),
  );

  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(`google_token_failed: ${body.error_description ?? res.status}`);
  }
  cachedToken = { value: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return cachedToken.value;
}

/** True when the issuer + service-account credentials are present. */
export function googleWalletConfigured(): boolean {
  return Boolean(
    Deno.env.get('GOOGLE_WALLET_ISSUER_ID') &&
      Deno.env.get('GOOGLE_WALLET_SA_EMAIL') &&
      Deno.env.get('GOOGLE_WALLET_SA_PRIVATE_KEY'),
  );
}

/** Fully-qualified pass object id: `{issuer}.{serial}` (serial = public_token). */
export function passObjectId(serial: string): string {
  return `${Deno.env.get('GOOGLE_WALLET_ISSUER_ID')}.${serial}`;
}

/** Shared class all numerek passes belong to: `{issuer}.{suffix}`. */
export function passClassId(): string {
  const suffix = Deno.env.get('GOOGLE_WALLET_CLASS_SUFFIX') ?? 'numerek';
  return `${Deno.env.get('GOOGLE_WALLET_ISSUER_ID')}.${suffix}`;
}

/** Bind the env-derived ids to the shared (@stoliq/core) pass builder. */
export function buildPassObject(model: PassModel): Record<string, unknown> {
  return buildGooglePassObject(model, {
    objectId: passObjectId(model.serial),
    classId: passClassId(),
  });
}

/**
 * Mint the "save to wallet" JWT the guest's tap opens. Self-contained: we inline
 * the pass class so Google creates class + object on first save (no API call) —
 * the exact claim set scripts/wallet-save-url.ts proved against the live API.
 * Returns null until `GOOGLE_WALLET_SA_PRIVATE_KEY` is provisioned.
 */
export async function buildSaveJwt(model: PassModel): Promise<string | null> {
  if (!googleWalletConfigured()) return null;
  const claims = {
    iss: Deno.env.get('GOOGLE_WALLET_SA_EMAIL') ?? '',
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      // Inlining the class lets Google create it on first save (no API call).
      genericClasses: [{ id: passClassId() }],
      genericObjects: [buildPassObject(model)],
    },
  };
  const jwt = await signRs256(claims, await importSaKey());
  return `${SAVE_URL_BASE}${jwt}`;
}

/**
 * Push the new state to a saved pass. Google fans a single object update out to
 * every device that saved it, so there is nothing per-device to iterate.
 *
 * Notify policy (§7.2, commit "separate silent PATCH from notifying addMessage"):
 *   • a PATCH updates the pass CONTENT silently and is unlimited — always done;
 *   • `opts.notify` additionally POSTs one addMessage(TEXT_AND_NOTIFY), which
 *     rings the phone and counts against Google's cap of 3 per pass per 24h.
 * Callers ring only on the earned moments (heads_up / table_ready / renotify);
 * position ticks PATCH silently. A 429 on the ring means the 3/24h budget is
 * spent — the content already updated, so that is not a delivery failure.
 */
export async function sendGooglePassUpdate(
  db: SupabaseClient,
  visitId: string,
  model: PassModel,
  opts: { notify?: boolean } = {},
): Promise<{ ok: boolean; sent: number; error: string | null }> {
  // Targets first: "the guest never saved a pass" is nothing to do, not a
  // failure — and it's the only honest answer while wallet is unprovisioned.
  const { data, error } = await db
    .from('guest_push_targets')
    .select('id, wallet_serial')
    .eq('visit_id', visitId)
    .eq('kind', 'google_wallet')
    .is('revoked_at', null);
  if (error) throw error;

  const targets = (data ?? []) as Array<{ id: string; wallet_serial: string | null }>;
  // The guest never saved a Google pass — page-only, not a failure.
  if (targets.length === 0) return { ok: true, sent: 0, error: null };

  if (!googleWalletConfigured()) {
    return { ok: false, sent: 0, error: 'google_wallet_not_configured' };
  }

  const objectId = passObjectId(model.serial);
  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    return { ok: false, sent: 0, error: err instanceof Error ? err.message : 'google_token_error' };
  }

  // 1. Silent content update — Google pushes it to every saved device, no ring.
  const patchRes = await fetch(`${WALLET_API}/genericObject/${encodeURIComponent(objectId)}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(buildPassObject(model)),
  });
  if (!patchRes.ok) {
    const detail = (await patchRes.text()).slice(0, 160);
    return { ok: false, sent: 0, error: `google_patch_${patchRes.status}: ${detail}` };
  }

  // 2. Ring only when earned — spend one of the 3/24h notifying messages.
  let notifyError: string | null = null;
  if (opts.notify) {
    const p = presentPass(model);
    const msgRes = await fetch(
      `${WALLET_API}/genericObject/${encodeURIComponent(objectId)}/addMessage`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            // Unique id keeps repeat sends from stacking duplicate messages.
            id: `${model.status}-${Date.now()}`,
            header: model.venueName,
            // Prepend the ready-shout on the notified moment — branch on the
            // semantic state, not a localized literal (headline is pl/en).
            body: model.status === 'notified' ? `${p.headline} — ${p.detail}` : p.detail,
            messageType: 'TEXT_AND_NOTIFY',
          },
        }),
      },
    );
    // 429 = the 3/24h budget is spent; the pass still updated, so not a failure.
    if (!msgRes.ok && msgRes.status !== 429) {
      notifyError = `google_notify_${msgRes.status}`;
    }
  }

  return { ok: true, sent: targets.length, error: notifyError };
}
