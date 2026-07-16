/**
 * Public visit tokens (§4). Each visit gets an unguessable 16-char base58 key
 * that becomes the guest URL (`stq.pl/v/{token}`). Base58 drops the visually
 * ambiguous glyphs (0/O, I/l) so a token is safe to read off a QR-less fallback
 * or dictate over the phone. Pure + deterministic given `rand`, so it is trivially
 * testable and can be reused by the `create_visit` RPC and the seed.
 */

/** Base58 alphabet — Bitcoin ordering, no 0 O I l (§4 "16-char base58"). */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Length of a public token (§4). */
export const PUBLIC_TOKEN_LENGTH = 16;

/**
 * Generate a 16-char base58 public token. `rand` defaults to `Math.random`;
 * pass a seeded generator (returning [0, 1)) for deterministic output in tests
 * or a reproducible seed run.
 */
export function generatePublicToken(rand: () => number = Math.random): string {
  const alphabetLength = BASE58_ALPHABET.length;
  let token = '';
  for (let i = 0; i < PUBLIC_TOKEN_LENGTH; i += 1) {
    // Clamp defensively: a rand() returning exactly 1 must not index out of range.
    const index = Math.min(alphabetLength - 1, Math.floor(rand() * alphabetLength));
    token += BASE58_ALPHABET.charAt(index);
  }
  return token;
}
