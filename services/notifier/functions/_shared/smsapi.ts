/**
 * SMSAPI.pl REST client (§2, §7.4). Polish provider, alphanumeric sender
 * "STOLIQ". We POST to the send endpoint, ask for the JSON `format`, and parse
 * back the per-message parts (segments) and points (cost) so we can write an
 * accurate `notifications` row and debit `venues.sms_balance_grosz` (§7.1).
 *
 * The HTTP call is isolated in `postSms` so it can be stubbed cleanly in tests;
 * the real endpoint lives in `SMSAPI_ENDPOINT`.
 */
import { analyze, type SegmentInfo } from '@stoliq/core';
import { requireEnv } from './admin.ts';

/** SMSAPI single-message REST endpoint (JSON response). */
export const SMSAPI_ENDPOINT = 'https://api.smsapi.pl/sms.do';

export interface SendSmsInput {
  to: string; // E.164, e.g. +48…
  body: string;
  /** alphanumeric sender name, defaults to env SMS_SENDER / "STOLIQ" */
  sender?: string;
}

export interface SendSmsResult {
  ok: boolean;
  providerId: string | null;
  /** number of SMS parts the provider actually charged for */
  segments: number;
  /** cost in grosz (integer) derived from provider "points" */
  costGrosz: number | null;
  error: string | null;
  /** raw provider payload for debugging / Sentry breadcrumbs */
  raw: unknown;
}

/** SMSAPI success payload (subset we consume). */
interface SmsApiOk {
  count: number;
  list: Array<{
    id: string;
    points: number; // provider billing points ≈ zł
    status: string;
    parts?: number;
    error?: number;
  }>;
}

/** SMSAPI error payload. */
interface SmsApiError {
  error: number;
  message: string;
}

function isError(payload: unknown): payload is SmsApiError {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'number'
  );
}

/**
 * Low-level POST to SMSAPI. Kept minimal and side-effect-only so tests can mock
 * `fetch`. Uses Bearer token auth (SMSAPI OAuth token, §12.5 `SMSAPI_TOKEN`).
 */
export async function postSms(input: SendSmsInput): Promise<unknown> {
  const token = requireEnv('SMSAPI_TOKEN');
  const sender = input.sender ?? Deno.env.get('SMS_SENDER') ?? 'STOLIQ';

  const params = new URLSearchParams({
    to: input.to.replace(/^\+/, ''), // SMSAPI expects digits without leading +
    message: input.body,
    from: sender,
    format: 'json',
    encoding: 'utf-8',
  });

  const res = await fetch(SMSAPI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  return await res.json();
}

/** Convert provider "points" (≈ zł) to integer grosz for the wallet ledger. */
function pointsToGrosz(points: number): number {
  return Math.round(points * 100);
}

/**
 * Send one SMS and normalise the provider response into `SendSmsResult`. We fall
 * back to our own `analyze()` segment count when the provider omits `parts`, so
 * the `notifications` row always has a segment figure.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const localAnalysis: SegmentInfo = analyze(input.body);

  let payload: unknown;
  try {
    payload = await postSms(input);
  } catch (err) {
    return {
      ok: false,
      providerId: null,
      segments: localAnalysis.segments,
      costGrosz: null,
      error: err instanceof Error ? err.message : 'network_error',
      raw: null,
    };
  }

  if (isError(payload)) {
    return {
      ok: false,
      providerId: null,
      segments: localAnalysis.segments,
      costGrosz: null,
      error: `smsapi_${payload.error}: ${payload.message}`,
      raw: payload,
    };
  }

  const ok = payload as SmsApiOk;
  const first = ok.list?.[0];
  if (!first) {
    return {
      ok: false,
      providerId: null,
      segments: localAnalysis.segments,
      costGrosz: null,
      error: 'smsapi_empty_list',
      raw: payload,
    };
  }
  if (typeof first.error === 'number' && first.error !== 0) {
    return {
      ok: false,
      providerId: first.id ?? null,
      segments: first.parts ?? localAnalysis.segments,
      costGrosz: null,
      error: `smsapi_msg_${first.error}`,
      raw: payload,
    };
  }

  return {
    ok: true,
    providerId: first.id ?? null,
    segments: first.parts ?? localAnalysis.segments,
    costGrosz: pointsToGrosz(first.points ?? 0),
    error: null,
    raw: payload,
  };
}
