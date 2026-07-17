import 'server-only';
import { createSign } from 'node:crypto';
import { buildGooglePassObject, type PassModel } from '@stoliq/core';

/**
 * Google Wallet save-URL signing (docs/specs/push-notifications.md).
 *
 * SERVER-ONLY — holds the service-account private key. `import 'server-only'`
 * makes a client import a build error rather than a leaked key.
 *
 * In production the notifier's `issue-pass` edge function owns this; this exists
 * so a backend-less deploy (demo tokens, no Supabase) can still hand out a real
 * pass. The pass body comes from @stoliq/core, so both paths build the identical
 * numerek (§3 — shared logic is never copy-pasted).
 */

const SAVE_URL_BASE = 'https://pay.google.com/gp/v/save/';

export function googlePassConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SA_EMAIL &&
      process.env.GOOGLE_WALLET_SA_PRIVATE_KEY,
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** SA keys carry literal `\n` escapes in JSON/env; crypto needs real newlines. */
function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
}

function signRs256(claims: object, privateKeyPem: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${b64url(signer.sign(privateKeyPem))}`;
}

/**
 * Mint a save URL for one numerek. Inlines the pass class so Google creates it
 * on first save — no OAuth2 token or separate Wallet API call needed.
 */
export function buildSaveUrl(model: PassModel): string | null {
  if (!googlePassConfigured()) return null;

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID as string;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL as string;
  const privateKey = normalizePem(process.env.GOOGLE_WALLET_SA_PRIVATE_KEY as string);
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'numerek';

  const classId = `${issuerId}.${classSuffix}`;
  const objectId = `${issuerId}.${model.serial}`;

  const jwt = signRs256(
    {
      iss: saEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      payload: {
        genericClasses: [{ id: classId }],
        genericObjects: [buildGooglePassObject(model, { objectId, classId })],
      },
    },
    privateKey,
  );

  return `${SAVE_URL_BASE}${jwt}`;
}
