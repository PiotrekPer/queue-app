/**
 * Resend email client (§2, §7.1). The optional fallback channel: when a guest
 * gave an email instead of a phone we can still notify them (~0 cost). Also used
 * for the low-balance owner alert and the daily digest in other tracks.
 *
 * The HTTP call is isolated in `postEmail` so tests can stub `fetch`; the real
 * endpoint lives in `RESEND_ENDPOINT`.
 */
import { optionalEnv } from './admin.ts';

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Default From — alphanumeric brand identity mirrors the SMS sender (§7.2). */
export const DEFAULT_EMAIL_FROM = 'Stoliq <powiadomienia@stq.pl>';

export interface SendEmailInput {
  to: string;
  subject: string;
  /** plain-text body (guest notifications are short + link-based, §8) */
  text: string;
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  providerId: string | null;
  error: string | null;
  raw: unknown;
}

interface ResendOk {
  id: string;
}

interface ResendError {
  name?: string;
  message: string;
}

function isResendError(payload: unknown): payload is ResendError {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    !('id' in payload)
  );
}

/** Low-level POST to Resend. Kept minimal so tests can mock `fetch`. */
export async function postEmail(input: SendEmailInput): Promise<unknown> {
  const key = optionalEnv('RESEND_API_KEY');
  if (!key) throw new Error('missing_env: RESEND_API_KEY');

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from ?? DEFAULT_EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });

  return await res.json();
}

/** Send one email and normalise the Resend response. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let payload: unknown;
  try {
    payload = await postEmail(input);
  } catch (err) {
    return {
      ok: false,
      providerId: null,
      error: err instanceof Error ? err.message : 'network_error',
      raw: null,
    };
  }

  if (isResendError(payload)) {
    return { ok: false, providerId: null, error: payload.message, raw: payload };
  }

  const ok = payload as ResendOk;
  if (!ok.id) {
    return { ok: false, providerId: null, error: 'resend_no_id', raw: payload };
  }
  return { ok: true, providerId: ok.id, error: null, raw: payload };
}
