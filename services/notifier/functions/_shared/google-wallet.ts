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
import { buildGooglePassObject, type PassModel } from '@stoliq/core';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
export const SAVE_URL_BASE = 'https://pay.google.com/gp/v/save/';

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
 * Mint the "save to wallet" JWT the guest's tap opens.
 *
 * NOT YET IMPLEMENTED — needs the service-account key to RS256-sign the claim
 * set { iss, aud: 'google', typ: 'savetowallet', payload: { genericObjects } }.
 * Returns null until `GOOGLE_WALLET_SA_PRIVATE_KEY` is provisioned.
 */
export function buildSaveJwt(_model: PassModel): Promise<string | null> {
  if (!googleWalletConfigured()) return Promise.resolve(null);
  // TODO(wallet): RS256-sign with GOOGLE_WALLET_SA_PRIVATE_KEY (Web Crypto:
  // importKey('pkcs8') → sign('RSASSA-PKCS1-v1_5')), then return
  // `${SAVE_URL_BASE}${jwt}` for the client to open.
  return Promise.resolve(null);
}

/**
 * Push the new state to a saved pass. Google notifies every device that saved
 * it, so there is nothing per-device to iterate — one PATCH per visit.
 *
 * NOT YET IMPLEMENTED — needs an OAuth2 access token minted from the service
 * account (JWT-bearer grant) to authorize the PATCH.
 */
export async function sendGooglePassUpdate(
  db: SupabaseClient,
  visitId: string,
  model: PassModel,
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

  // TODO(wallet): PATCH `${WALLET_API}/genericObject/${passObjectId(model.serial)}`
  //   headers: authorization: Bearer <OAuth2 token via SA JWT-bearer grant>
  //   body: buildPassObject(model)  → Google notifies all saved devices.
  void WALLET_API;
  void buildPassObject(model);
  return { ok: false, sent: 0, error: 'google_wallet_not_implemented' };
}
