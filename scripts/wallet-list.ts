/**
 * Dev tool: list the numerek pass objects saved under our Wallet class.
 *
 *   pnpm wallet:list
 *
 * Handy when you need the real object id of a pass you saved from a browser
 * (the save URL mints a fresh serial each run, so it is easy to lose track).
 */
import { createSign } from 'node:crypto';

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

function signRs256(claims: object, pem: string): string {
  const input = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  const s = createSign('RSA-SHA256');
  s.update(input);
  s.end();
  return `${input}.${b64url(s.sign(pem))}`;
}

async function main(): Promise<void> {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const saEmail = requireEnv('GOOGLE_WALLET_SA_EMAIL');
  const pem = requireEnv('GOOGLE_WALLET_SA_PRIVATE_KEY').replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || 'numerek';
  const classId = `${issuerId}.${classSuffix}`;

  const now = Math.floor(Date.now() / 1000);
  const assertion = signRs256(
    { iss: saEmail, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 },
    pem,
  );
  const tokRes = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tok = (await tokRes.json()) as { access_token?: string; error_description?: string };
  if (!tok.access_token) {
    console.error(`\n✗ Token failed: ${tok.error_description ?? 'unknown'}\n`);
    process.exit(1);
  }

  const res = await fetch(
    `${WALLET_API}/genericObject?classId=${encodeURIComponent(classId)}`,
    { headers: { authorization: `Bearer ${tok.access_token}` } },
  );
  const body = await res.text();
  if (!res.ok) {
    console.error(`\n✗ List failed (${res.status})\n${body.slice(0, 400)}\n`);
    process.exit(1);
  }

  type Localized = { defaultValue?: { value?: string } };
  const parsed = JSON.parse(body) as {
    resources?: Array<{
      id: string;
      state?: string;
      header?: Localized;
      subheader?: Localized;
      hexBackgroundColor?: string;
    }>;
  };
  const rows = parsed.resources ?? [];

  console.log(`\nObjects in class ${classId}: ${rows.length}\n`);
  for (const r of rows) {
    const serial = r.id.split('.').slice(1).join('.');
    const header = r.header?.defaultValue?.value ?? '?';
    const sub = r.subheader?.defaultValue?.value ?? '';
    // #1F9D5B is token color.ready-fill — the pass only wears it when a table
    // is ready (§9.2), so the colour alone tells you the state.
    const ready = r.hexBackgroundColor?.toUpperCase() === '#1F9D5B';
    console.log(`  ${serial}`);
    console.log(`    shows:  "${header}" ${sub ? `/ "${sub}"` : ''}`);
    console.log(`    state:  ${r.state ?? '?'}  bg=${r.hexBackgroundColor ?? '?'}${ready ? '  ← STOLIK GOTOWY' : ''}\n`);
  }
  console.log(
    rows.length
      ? `\nUpdate one with:\n  pnpm wallet:update ${rows[0]!.id.split('.').slice(1).join('.')} notified\n`
      : '\n(no saved objects yet)\n',
  );
}

void main();
