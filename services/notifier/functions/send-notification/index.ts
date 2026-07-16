/**
 * send-notification (§7.4) — process a single notification job by id.
 *
 * POST { job_id }. Locks the job (idempotency key = job id), loads
 * visit+venue+guest+template, renders + analyses segments, applies §7.1 gating,
 * calls SMSAPI (or Resend for email), writes a `notifications` row with
 * segments+cost, debits the SMS wallet, and marks the job done — or schedules a
 * retry (30s/2m/10m ×3) then fails it out with a Sentry-style console.error.
 *
 * This is a service-only endpoint (invoked by the sweep / staff action pipeline),
 * so it does not need CORS preflight, but it shares the JSON helper.
 */
import { z } from 'zod';
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json } from '../_shared/cors.ts';
import { runJobById } from '../_shared/jobs.ts';

const BodySchema = z.object({ job_id: z.string().uuid() });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(errorBody('method_not_allowed'), 405);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(errorBody('invalid_json'), 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(errorBody('invalid_input', parsed.error.message), 400);
  }

  try {
    const db = adminClient();
    const result = await runJobById(db, parsed.data.job_id);
    return json(result, 200);
  } catch (err) {
    console.error('[send-notification] error', err);
    return json(errorBody('internal_error'), 500);
  }
});
