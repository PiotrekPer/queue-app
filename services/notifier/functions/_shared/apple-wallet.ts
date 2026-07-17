/**
 * Apple Wallet (PassKit) — build + sign a `.pkpass`, and push updates to it
 * (docs/specs/push-notifications.md, Phase B).
 *
 * How the "STOLIK GOTOWY" moment reaches an iPhone lock screen with NO app and
 * NO install (§1 guest contract):
 *   1. guest taps "Dodaj do Apple Wallet" → `issue-pass` returns a signed .pkpass
 *   2. iOS adds it and calls our web service to REGISTER the device
 *      (POST …/v1/devices/{deviceId}/registrations/{passTypeId}/{serial})
 *      → we store a `guest_push_targets` row (kind='apple_wallet') with the
 *        device's APNs push token
 *   3. on notify, we send an EMPTY APNs push to that token
 *   4. iOS wakes and re-fetches the pass from
 *      GET …/v1/passes/{passTypeId}/{serial} → we return the green pass
 *      → iOS shows a lock-screen change notification. Free, forever.
 *
 * ── CREDENTIALS (must be provisioned; see §6 of the spec) ────────────────────
 *   APPLE_PASS_TYPE_ID     e.g. pass.pl.stq.numerek
 *   APPLE_TEAM_ID          10-char Apple Developer team id
 *   APPLE_PASS_CERT_P12    base64 of the Pass Type ID cert (.p12)
 *   APPLE_PASS_CERT_PASSWORD
 *   APPLE_APNS_KEY_P8      base64 of the APNs auth key (.p8)
 *   APPLE_APNS_KEY_ID / APPLE_APNS_TEAM_ID
 * Until these exist every entry point degrades to `not_configured` rather than
 * throwing — the guest page simply doesn't offer the button (§1: never block).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hexToRgbString,
  presentPass,
  ticketLabel,
  type PassModel,
} from '@stoliq/core';

/** True when the signing + APNs credentials are present. */
export function appleWalletConfigured(): boolean {
  return Boolean(
    Deno.env.get('APPLE_PASS_TYPE_ID') &&
      Deno.env.get('APPLE_TEAM_ID') &&
      Deno.env.get('APPLE_PASS_CERT_P12') &&
      Deno.env.get('APPLE_APNS_KEY_P8'),
  );
}

/**
 * The `pass.json` document (PassKit). We use a `generic` pass: the numerek is a
 * queue ticket, not a dated event. `webServiceURL` + `authenticationToken` are
 * what make the pass updatable — without them iOS never registers a device.
 */
export function buildPassJson(model: PassModel, webServiceUrl: string): Record<string, unknown> {
  const p = presentPass(model);

  return {
    formatVersion: 1,
    passTypeIdentifier: Deno.env.get('APPLE_PASS_TYPE_ID'),
    teamIdentifier: Deno.env.get('APPLE_TEAM_ID'),
    serialNumber: model.serial,
    organizationName: model.venueName,
    description: `${model.venueName} — ${ticketLabel(model)}`,

    // The pass's own auth: iOS sends this back on every web-service call. The
    // public_token is already the guest's unguessable key (§4.2), so it doubles
    // as the pass secret — no extra credential to manage or leak.
    webServiceURL: webServiceUrl,
    authenticationToken: model.serial,

    foregroundColor: hexToRgbString(p.foregroundColor),
    backgroundColor: hexToRgbString(p.backgroundColor),
    labelColor: hexToRgbString(p.labelColor),
    logoText: model.venueName,

    // Scannable at the host stand; also the guest's way back to the live page.
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: model.ticketUrl,
        messageEncoding: 'iso-8859-1',
      },
    ],

    generic: {
      // THE element (§9.4): position while waiting, the shout when ready.
      primaryFields: [
        { key: 'headline', label: p.headlineLabel, value: p.headline },
      ],
      secondaryFields: [
        { key: 'ticket', label: ticketLabel(model), value: `#${model.ticketNo}` },
      ],
      auxiliaryFields: [{ key: 'detail', label: '', value: p.detail }],
      backFields: [
        { key: 'live', label: 'Na żywo', value: model.ticketUrl },
        {
          key: 'rodo',
          label: 'RODO',
          value: 'Twoje dane znikają automatycznie po zakończeniu wizyty.',
        },
      ],
    },
  };
}

/**
 * Build and sign the `.pkpass` archive (a zip of pass.json + manifest.json +
 * signature + images).
 *
 * NOT YET IMPLEMENTED — needs the Pass Type ID certificate to produce the
 * PKCS#7 detached signature over manifest.json. Deno has no bundled PKCS#7
 * signer, so this will use a small CMS lib (or an Edge-compatible openssl WASM
 * build) once `APPLE_PASS_CERT_P12` is provisioned. Callers must handle null.
 */
export function buildSignedPkpass(
  _model: PassModel,
  _webServiceUrl: string,
): Promise<Uint8Array | null> {
  if (!appleWalletConfigured()) return Promise.resolve(null);
  // TODO(wallet): zip(pass.json, manifest.json(sha1 per file), signature(PKCS#7
  // detached, signed with APPLE_PASS_CERT_P12), icon.png/logo.png @1x/@2x).
  return Promise.resolve(null);
}

/**
 * Wake every registered iOS device for this visit so it re-fetches the pass.
 * PassKit's update push carries NO payload — an empty aps dict is the whole
 * message; the device then pulls the new pass from our web service.
 *
 * NOT YET IMPLEMENTED — needs the APNs auth key to mint the JWT bearer.
 */
export async function sendApplePassUpdate(
  db: SupabaseClient,
  visitId: string,
): Promise<{ ok: boolean; sent: number; error: string | null }> {
  // Targets first: "the guest never added a pass" is nothing to do, not a
  // failure — and it's the only honest answer while wallet is unprovisioned.
  const { data, error } = await db
    .from('guest_push_targets')
    .select('id, endpoint')
    .eq('visit_id', visitId)
    .eq('kind', 'apple_wallet')
    .is('revoked_at', null);
  if (error) throw error;

  const targets = (data ?? []) as Array<{ id: string; endpoint: string | null }>;
  if (targets.length === 0) return { ok: true, sent: 0, error: null };

  if (!appleWalletConfigured()) {
    return { ok: false, sent: 0, error: 'apple_wallet_not_configured' };
  }

  // TODO(wallet): POST https://api.push.apple.com/3/device/{pushToken}
  //   headers: authorization: bearer <ES256 JWT from APPLE_APNS_KEY_P8>,
  //            apns-topic: <APPLE_PASS_TYPE_ID>, apns-push-type: background
  //   body: {} (empty aps — PassKit update pushes carry no payload)
  // Revoke targets on 410 (device unregistered), mirroring webpush pruning.
  return { ok: false, sent: 0, error: 'apple_apns_not_implemented' };
}
