/**
 * Dev tool: mint a real Google Wallet "save" URL for a demo numerek.
 *
 *   pnpm wallet:save-url
 *
 * Proves the whole Google Wallet path (credentials → signing → a pass on a real
 * phone) WITHOUT Supabase, hosting, or the notifier — a save URL is a
 * self-contained signed JWT on a pay.google.com link. We inline the pass CLASS
 * alongside the object, so Google creates the class on first save and we don't
 * need an OAuth2 token or a separate Wallet API call.
 *
 * The pass itself comes from @stoliq/core (`buildGooglePassObject`), i.e. the
 * exact same builder the notifier uses — this tool can't drift from production.
 *
 * Requires in .env:
 *   GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_PRIVATE_KEY
 * Run with Node's --env-file (see the package.json script).
 */
import { createSign } from 'node:crypto';
import { buildGooglePassObject, type PassModel } from '@stoliq/core';

const SAVE_URL_BASE = 'https://pay.google.com/gp/v/save/';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim().length === 0) {
    console.error(`\n✗ Missing ${key} in .env\n`);
    process.exit(1);
  }
  return v.trim();
}

/** base64url without padding — JWT segments. */
function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Service-account keys arrive from the JSON with literal `\n` escapes. Env files
 * keep them escaped, so unescape before handing the PEM to crypto.
 */
function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
}

function signRs256(claims: object, privateKeyPem: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKeyPem);
  return `${signingInput}.${b64url(signature)}`;
}

function main(): void {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const saEmail = requireEnv('GOOGLE_WALLET_SA_EMAIL');
  const privateKey = normalizePem(requireEnv('GOOGLE_WALLET_SA_PRIVATE_KEY'));
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || 'numerek';

  // A demo visit. `serial` must be unique per saved pass — reusing one returns
  // the SAME pass, which is handy for testing updates but confusing otherwise.
  const serial = process.argv[2] ?? `demo-${Date.now()}`;
  const status = (process.argv[3] as PassModel['status']) ?? 'waiting';

  const model: PassModel = {
    serial,
    venueName: 'Trattoria Demo',
    ticketNo: 47,
    status,
    position: status === 'waiting' ? 3 : null,
    ticketUrl: `https://stq.pl/v/${serial}`,
    locale: 'pl',
  };

  const objectId = `${issuerId}.${serial}`;
  const classId = `${issuerId}.${classSuffix}`;

  const claims = {
    iss: saEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      // Inlining the class lets Google create it on first save (no API call).
      genericClasses: [{ id: classId }],
      genericObjects: [buildGooglePassObject(model, { objectId, classId })],
    },
  };

  const jwt = signRs256(claims, privateKey);
  const url = `${SAVE_URL_BASE}${jwt}`;

  console.log(`\n✓ Signed a save URL for ${serial} (status: ${status})`);
  console.log(`  class:  ${classId}`);
  console.log(`  object: ${objectId}`);
  console.log(`\nOpen this in Chrome signed in as your Wallet TEST account`);
  console.log(`(it syncs to the phone on that same account):\n`);
  console.log(url);
  console.log(`\n  JWT length: ${jwt.length} chars\n`);
}

main();
