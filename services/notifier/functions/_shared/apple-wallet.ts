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
 *      GET …/v1/passes/{passTypeId}/{serial} → we return the green pass. The
 *      updated field carries a `changeMessage`, so iOS shows a lock-screen
 *      notification. Free, forever.
 *
 * ── CREDENTIALS (must be provisioned; see §6 of the spec) ────────────────────
 *   APPLE_PASS_TYPE_ID       e.g. pass.pl.stq.numerek
 *   APPLE_TEAM_ID            10-char Apple Developer team id
 *   APPLE_PASS_CERT_P12      base64 of the Pass Type ID cert bundle (.p12)
 *   APPLE_PASS_CERT_PASSWORD (may be empty)
 *   APPLE_WWDR_CERT          Apple WWDR intermediate (G4) cert, PEM (base64 or raw)
 *   APPLE_APNS_KEY_P8        the APNs auth key (.p8, EC P-256, PKCS#8 PEM)
 *   APPLE_APNS_KEY_ID        the key id (kid)
 *   APPLE_APNS_TEAM_ID       team id for the APNs JWT iss (defaults to APPLE_TEAM_ID)
 * Until these exist every entry point degrades to `not_configured` rather than
 * throwing — the guest page simply doesn't offer the button (§1: never block).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import forge from 'node-forge';
import { zipSync, strToU8 } from 'fflate';
import {
  hexToRgbString,
  presentPass,
  ticketLabel,
  type PassModel,
} from '@stoliq/core';

const APNS_HOST = 'https://api.push.apple.com';

/** True when the signing + APNs credentials are all present. */
export function appleWalletConfigured(): boolean {
  return Boolean(
    Deno.env.get('APPLE_PASS_TYPE_ID') &&
      Deno.env.get('APPLE_TEAM_ID') &&
      Deno.env.get('APPLE_PASS_CERT_P12') &&
      Deno.env.get('APPLE_WWDR_CERT') &&
      Deno.env.get('APPLE_APNS_KEY_P8') &&
      Deno.env.get('APPLE_APNS_KEY_ID'),
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
      // THE element (§9.4): position while waiting, the shout when ready. The
      // `changeMessage` is what turns a pass UPDATE into a lock-screen
      // NOTIFICATION — without it the update is applied silently (§7.2). "%@"
      // is replaced with the new field value (e.g. "STOLIK GOTOWY").
      primaryFields: [
        { key: 'headline', label: p.headlineLabel, value: p.headline, changeMessage: '%@' },
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
 * Build and sign the `.pkpass` archive (a zip of pass.json + icons +
 * manifest.json + signature).
 *
 * manifest.json = SHA-1 of every payload file (PassKit requirement). signature =
 * a PKCS#7 DETACHED signature over manifest.json, signed with the Pass Type ID
 * cert + the WWDR intermediate. Deno has no CMS signer, so we use node-forge.
 *
 * NOTE: icon.png is REQUIRED by PassKit. We bundle a tiny placeholder so the
 * archive is structurally valid; replace ICON_PNG with real brand icons
 * (29/58/87px + logo) before shipping to real devices. Returns null when the
 * signing credentials are missing.
 */
export function buildSignedPkpass(
  model: PassModel,
  webServiceUrl: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!appleWalletConfigured()) return Promise.resolve(null);

  const files: Record<string, Uint8Array> = {
    'pass.json': strToU8(JSON.stringify(buildPassJson(model, webServiceUrl))),
    'icon.png': ICON_PNG,
    'icon@2x.png': ICON_PNG,
    'logo.png': ICON_PNG,
  };

  // manifest.json: filename → SHA-1 hex, excluding manifest.json + signature.
  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1Hex(bytes);
  const manifestBytes = strToU8(JSON.stringify(manifest));

  const signature = signManifestPkcs7(manifestBytes);
  if (!signature) return Promise.resolve(null);

  const zipped = zipSync({ ...files, 'manifest.json': manifestBytes, signature });
  // Copy into a fresh ArrayBuffer-backed view so the type is BufferSource.
  return Promise.resolve(new Uint8Array(zipped));
}

/**
 * Wake every registered iOS device for this visit so it re-fetches the pass.
 * PassKit's update push carries NO payload — an empty body is the whole message;
 * the device then pulls the new pass from our web service. Auth is a token-based
 * APNs JWT (ES256) from the .p8 key; the topic is the pass type id.
 */
export async function sendApplePassUpdate(
  db: SupabaseClient,
  visitId: string,
): Promise<{ ok: boolean; sent: number; error: string | null }> {
  // Targets first: "the guest never added a pass" is nothing to do, not a
  // failure — and it's the only honest answer while wallet is unprovisioned.
  const { data, error } = await db
    .from('guest_push_targets')
    .select('id, endpoint, created_at')
    .eq('visit_id', visitId)
    .eq('kind', 'apple_wallet')
    .is('revoked_at', null);
  if (error) throw error;

  const targets = (data ?? []) as Array<{
    id: string;
    endpoint: string | null;
    created_at: string | null;
  }>;
  if (targets.length === 0) return { ok: true, sent: 0, error: null };

  if (!appleWalletConfigured()) {
    return { ok: false, sent: 0, error: 'apple_wallet_not_configured' };
  }

  let jwt: string;
  try {
    jwt = await apnsJwt();
  } catch (err) {
    return { ok: false, sent: 0, error: err instanceof Error ? err.message : 'apns_token_error' };
  }

  const topic = Deno.env.get('APPLE_PASS_TYPE_ID') ?? '';
  let sent = 0;
  let lastError: string | null = null;

  for (const t of targets) {
    if (!t.endpoint) continue;
    // apns-push-type: 'background' + empty body is the documented shape for a
    // Wallet update; the device is woken and pulls the fresh pass. (If a real
    // device doesn't update, this header is the first thing to revisit.)
    const res = await fetch(`${APNS_HOST}/3/device/${t.endpoint}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'background',
        'apns-priority': '5',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    if (res.ok) {
      await res.arrayBuffer().catch(() => undefined); // drain for HTTP/2 reuse
      sent += 1;
      continue;
    }
    const body = await res.text().catch(() => '');
    if (res.status === 410) {
      // Device unregistered — but only revoke if APNs's invalidation is NEWER
      // than our registration; a token re-registered since (register() resets
      // revoked_at) must survive. No/old timestamp → safe to revoke.
      let ts = 0;
      try {
        ts = Number((JSON.parse(body) as { timestamp?: number }).timestamp) || 0;
      } catch {
        ts = 0;
      }
      const registeredAt = t.created_at ? Date.parse(t.created_at) : 0;
      if (ts === 0 || ts >= registeredAt) {
        await db.from('guest_push_targets').update({ revoked_at: new Date().toISOString() }).eq('id', t.id);
      }
    } else {
      // Stale provider token → drop the cache so the next call re-mints (self-heal).
      if (res.status === 403 || res.status === 401) cachedApnsJwt = null;
      lastError = `apns_${res.status}`;
    }
  }

  return { ok: sent > 0 || lastError === null, sent, error: sent > 0 ? null : lastError };
}

// ── crypto / encoding helpers ────────────────────────────────────────────────

function toBinaryString(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

function binaryStringToBytes(bin: string): Uint8Array {
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function sha1Hex(bytes: Uint8Array): string {
  const md = forge.md.sha1.create();
  md.update(toBinaryString(bytes));
  return md.digest().toHex();
}

/** SA/APNs values arrive with literal `\n` escapes in env; unescape + de-quote. */
function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const der = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) der[i] = bin.charCodeAt(i);
  return der;
}

/** PKCS#7 detached signature (DER) over manifest.json — the .pkpass `signature`. */
function signManifestPkcs7(manifestBytes: Uint8Array): Uint8Array | null {
  const p12b64 = Deno.env.get('APPLE_PASS_CERT_P12') ?? '';
  const password = Deno.env.get('APPLE_PASS_CERT_PASSWORD') ?? '';
  const wwdrPem = normalizePem(Deno.env.get('APPLE_WWDR_CERT') ?? '');

  const p12Der = forge.util.decode64(p12b64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), false, password);

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ??
    [];
  const keyBag = keyBags.find((b: { key?: unknown }) => b.key);
  const signerKey = keyBag?.key;

  // Match the signer cert to the private key — NEVER bag order. A Keychain-
  // exported .p12 can put the WWDR intermediate first; signing that (its
  // SignerInfo would identify WWDR) with the leaf key yields a pass iOS rejects.
  // Prefer the cert sharing the key's PKCS#9 localKeyId, else the non-CA leaf.
  const certBags = (
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  ).filter((b: { cert?: unknown }) => b.cert);
  const keyId = keyBag?.attributes?.localKeyId?.[0];
  const signerCert = (
    (keyId &&
      certBags.find(
        (b: { attributes?: { localKeyId?: unknown[] } }) => b.attributes?.localKeyId?.[0] === keyId,
      )) ||
    certBags.find(
      (b: { cert: { getExtension?: (n: string) => { cA?: boolean } | undefined } }) =>
        b.cert.getExtension?.('basicConstraints')?.cA !== true,
    ) ||
    certBags[0]
  )?.cert;
  if (!signerCert || !signerKey) return null;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(toBinaryString(manifestBytes));
  p7.addCertificate(signerCert);
  p7.addCertificate(forge.pki.certificateFromPem(wwdrPem));
  p7.addSigner({
    key: signerKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  return binaryStringToBytes(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

function b64urlBytes(bytes: Uint8Array): string {
  return btoa(toBinaryString(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlString(s: string): string {
  return b64urlBytes(new TextEncoder().encode(s));
}

let cachedApnsJwt: { value: string; iat: number } | null = null;

/** Token-based APNs auth: an ES256 JWT signed with the .p8 key, reused ~50 min. */
async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && now - cachedApnsJwt.iat < 3000) return cachedApnsJwt.value;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(Deno.env.get('APPLE_APNS_KEY_P8') ?? ''),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const iss = Deno.env.get('APPLE_APNS_TEAM_ID') ?? Deno.env.get('APPLE_TEAM_ID') ?? '';
  const input = `${b64urlString(
    JSON.stringify({ alg: 'ES256', kid: Deno.env.get('APPLE_APNS_KEY_ID') ?? '' }),
  )}.${b64urlString(JSON.stringify({ iss, iat: now }))}`;
  // Web Crypto ECDSA returns the raw r||s (IEEE P1363) that JWT ES256 wants.
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(input),
  );
  const jwt = `${input}.${b64urlBytes(new Uint8Array(sig))}`;
  cachedApnsJwt = { value: jwt, iat: now };
  return jwt;
}

// A 1×1 PNG placeholder so the .pkpass is structurally valid. Replace with real
// brand icons (icon.png 29px, icon@2x 58px, icon@3x 87px, logo.png) for devices.
const ICON_PNG: Uint8Array = binaryStringToBytes(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
);
