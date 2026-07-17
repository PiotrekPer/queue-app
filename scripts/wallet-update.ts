/**
 * Dev tool: PATCH a saved Google Wallet numerek to a new state.
 *
 *   pnpm wallet:update <serial> [status]      # status: waiting|notified|on_way|seated
 *   pnpm wallet:update demo-1784292495254 notified
 *
 * Proves the UPDATE half of the wallet path (the save URL proved the ADD half)
 * without Supabase or the notifier: mint an OAuth2 token from the service
 * account, PATCH the object, and Google pushes it to every device that saved it.
 *
 * The pass body comes from @stoliq/core (`buildGooglePassObject`) — the same
 * builder the guest page and notifier use, so this can't drift.
 *
 * NOTE: this is the dev twin of the notifier's `sendGooglePassUpdate()`. The
 * pass DESIGN is shared via core; only the auth/transport is repeated here,
 * because core must stay free of node:crypto (it is bundled into the Expo app
 * and the browser).
 */
import { createSign } from 'node:crypto';
import { buildGooglePassObject, type PassModel, type VisitStatus } from '@stoliq/core';

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) {
    console.error(`\n✗ Missing ${key} in .env\n`);
    process.exit(1);
  }
  return v.trim();
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
}

function signRs256(claims: object, pem: string): string {
  const input = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  const s = createSign('RSA-SHA256');
  s.update(input);
  s.end();
  return `${input}.${b64url(s.sign(pem))}`;
}

/** Service-account JWT-bearer grant → OAuth2 access token (§ Google auth). */
async function getAccessToken(saEmail: string, pem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signRs256(
    { iss: saEmail, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 },
    pem,
  );

  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    console.error(`\n✗ Token request failed (${res.status}): ${json.error_description ?? 'unknown'}\n`);
    process.exit(1);
  }
  return json.access_token;
}

async function main(): Promise<void> {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const saEmail = requireEnv('GOOGLE_WALLET_SA_EMAIL');
  const pem = normalizePem(requireEnv('GOOGLE_WALLET_SA_PRIVATE_KEY'));
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || 'numerek';

  const serial = process.argv[2];
  const status = (process.argv[3] as VisitStatus) ?? 'notified';
  if (!serial) {
    console.error('\nUsage: pnpm wallet:update <serial> [waiting|notified|on_way|seated]\n');
    process.exit(1);
  }

  const objectId = `${issuerId}.${serial}`;
  const classId = `${issuerId}.${classSuffix}`;

  const model: PassModel = {
    serial,
    venueName: 'Trattoria Demo',
    ticketNo: 47,
    status,
    position: status === 'waiting' ? 2 : null,
    ticketUrl: `https://stq.pl/v/${serial}`,
    locale: 'pl',
  };

  const token = await getAccessToken(saEmail, pem);

  const res = await fetch(`${WALLET_API}/genericObject/${encodeURIComponent(objectId)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildGooglePassObject(model, { objectId, classId })),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`\n✗ PATCH failed (${res.status})\n${body.slice(0, 400)}\n`);
    process.exit(1);
  }

  console.log(`\n✓ Updated ${objectId} → ${status}`);
  console.log('  Check the pass on your phone — it should show the new state.\n');
}

void main();
