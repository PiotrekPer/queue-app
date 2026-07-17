/**
 * Notification job processing (§7.4 delivery pipeline + §7.1 gating + §7.5
 * segments). Shared by `send-notification` (single job by id) and `sweep-timers`
 * (batch of due jobs). One place owns: lock → load → render → gate → send →
 * write `notifications` row → debit wallet → mark job done / schedule retry.
 *
 * Idempotency key = job id (§7.4). Retry ×3 with backoff 30s / 2m / 10m, then a
 * `failed` notifications row + console.error (Sentry breadcrumb) + a staff-
 * visible badge is derived from the failed row on the visit card.
 */
import {
  analyze,
  defaultTemplate,
  renderTemplate,
  type Locale,
  type TemplateKey,
} from '@stoliq/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ticketLink } from './links.ts';
import { sendSms } from './smsapi.ts';
import { sendEmail } from './resend.ts';
import { deliverPushForVisit } from './push.ts';
import { formatWarsawTimeSafe } from './time.ts';

/** Retry backoff schedule in milliseconds, indexed by attempt count (§7.4). */
export const RETRY_BACKOFF_MS = [30_000, 120_000, 600_000] as const;
export const MAX_ATTEMPTS = 3;

/** Owner-alert threshold: warn at ≤ 5 zł balance (§7.1). */
export const LOW_BALANCE_GROSZ = 500;

export interface JobRow {
  id: string;
  visit_id: string;
  template_key: TemplateKey;
  channel: 'sms' | 'email';
  run_after: string;
  attempts: number;
  locked_at: string | null;
  done_at: string | null;
}

export interface ProcessResult {
  jobId: string;
  outcome: 'sent' | 'skipped_gate' | 'retry' | 'failed' | 'not_found' | 'already_done';
  detail?: string;
}

interface VisitForSend {
  id: string;
  venue_id: string;
  guest_id: string | null;
  public_token: string;
  display_name: string | null;
  ticket_no: number;
  notified_at: string | null;
}

interface VenueForSend {
  id: string;
  name: string;
  plan: string;
  locale: Locale;
  sms_balance_grosz: number;
  settings: { hold_minutes?: number; channels?: { sms?: boolean; email?: boolean } };
}

interface GuestForSend {
  first_name: string | null;
  phone_e164: string | null;
  email: string | null;
}

/**
 * Atomically claim a single job: set `locked_at` only if it is currently null
 * and the job is not done. Returns the locked row, or null if another worker got
 * it (idempotency + no double-send across concurrent sweeps).
 */
export async function lockJob(db: SupabaseClient, jobId: string): Promise<JobRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('notification_jobs')
    .update({ locked_at: nowIso })
    .eq('id', jobId)
    .is('locked_at', null)
    .is('done_at', null)
    .select('id, visit_id, template_key, channel, run_after, attempts, locked_at, done_at')
    .maybeSingle();
  if (error) throw error;
  return (data as JobRow | null) ?? null;
}

/** Select due, unlocked, unfinished jobs for the sweep (§7.6 sweep_jobs). */
export async function selectDueJobs(db: SupabaseClient, limit = 50): Promise<JobRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('notification_jobs')
    .select('id, visit_id, template_key, channel, run_after, attempts, locked_at, done_at')
    .is('done_at', null)
    .is('locked_at', null)
    .lte('run_after', nowIso)
    .order('run_after', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JobRow[];
}

async function loadVisit(db: SupabaseClient, id: string): Promise<VisitForSend | null> {
  const { data, error } = await db
    .from('visits')
    .select('id, venue_id, guest_id, public_token, display_name, ticket_no, notified_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as VisitForSend | null) ?? null;
}

async function loadVenue(db: SupabaseClient, id: string): Promise<VenueForSend | null> {
  const { data, error } = await db
    .from('venues')
    .select('id, name, plan, locale, sms_balance_grosz, settings')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as VenueForSend | null) ?? null;
}

async function loadGuest(db: SupabaseClient, id: string | null): Promise<GuestForSend | null> {
  if (!id) return null;
  const { data, error } = await db
    .from('guests')
    .select('first_name, phone_e164, email')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as GuestForSend | null) ?? null;
}

/** Resolve the venue's editable template body, else the packaged default (§7.4). */
async function resolveTemplateBody(
  db: SupabaseClient,
  venueId: string,
  key: TemplateKey,
  locale: Locale,
): Promise<string> {
  const { data, error } = await db
    .from('message_templates')
    .select('body')
    .eq('venue_id', venueId)
    .eq('key', key)
    .eq('locale', locale)
    .maybeSingle();
  if (error) throw error;
  const custom = (data as { body: string } | null)?.body;
  return custom && custom.trim().length > 0 ? custom : defaultTemplate(key, locale);
}

/** Mark a job done (success) or reschedule it (retry) / fail it out (§7.4). */
async function finishJob(
  db: SupabaseClient,
  job: JobRow,
  ok: boolean,
): Promise<'done' | 'retry' | 'failed'> {
  if (ok) {
    await db
      .from('notification_jobs')
      .update({ done_at: new Date().toISOString() })
      .eq('id', job.id);
    return 'done';
  }

  const attempts = job.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    // Give up: keep it locked+not-done becomes noise, so mark done to stop the
    // sweep re-picking it; the failed `notifications` row carries the signal.
    await db
      .from('notification_jobs')
      .update({ attempts, done_at: new Date().toISOString() })
      .eq('id', job.id);
    return 'failed';
  }

  const backoff = RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)] as number;
  const runAfter = new Date(Date.now() + backoff).toISOString();
  await db
    .from('notification_jobs')
    .update({ attempts, run_after: runAfter, locked_at: null })
    .eq('id', job.id);
  return 'retry';
}

/**
 * Core pipeline for one already-locked job. Renders the template, applies §7.1
 * gating, sends via SMSAPI/Resend, writes a `notifications` row, debits the SMS
 * wallet, and finalises the job (done / retry / failed).
 */
export async function processLockedJob(
  db: SupabaseClient,
  job: JobRow,
): Promise<ProcessResult> {
  const visit = await loadVisit(db, job.visit_id);
  if (!visit) {
    await db
      .from('notification_jobs')
      .update({ done_at: new Date().toISOString() })
      .eq('id', job.id);
    return { jobId: job.id, outcome: 'not_found', detail: 'visit gone' };
  }

  const venue = await loadVenue(db, visit.venue_id);
  if (!venue) {
    await db
      .from('notification_jobs')
      .update({ done_at: new Date().toISOString() })
      .eq('id', job.id);
    return { jobId: job.id, outcome: 'not_found', detail: 'venue gone' };
  }

  const guest = await loadGuest(db, visit.guest_id);

  // ── §7.1 gating ──────────────────────────────────────────────────────────
  const paid = venue.plan === 'pro' || venue.plan === 'suite';
  const smsChannelOn = venue.settings.channels?.sms !== false;
  const emailChannelOn = venue.settings.channels?.email === true;
  const pushChannelOn = venue.settings.channels?.push !== false;

  const channel = job.channel;

  // ── push (free, all tiers) — docs/specs/push-notifications.md ──────────────
  // No plan gate, no wallet debit. Fans out to the visit's stored web-push
  // targets; "no targets" is a silent success (guest never opted in → page-only).
  if (channel === 'push') {
    if (!pushChannelOn) {
      await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
      return { jobId: job.id, outcome: 'skipped_gate', detail: 'push disabled' };
    }

    const body = await resolveTemplateBody(db, venue.id, job.template_key, venue.locale);
    const rendered = renderTemplate(body, {
      name: guest?.first_name ?? '',
      venue: venue.name,
      ticket_no: visit.ticket_no,
      hold: venue.settings.hold_minutes ?? 7,
      link: ticketLink(visit.public_token),
      time: formatWarsawTimeSafe(visit.notified_at),
    });

    const push = await deliverPushForVisit(db, {
      visitId: visit.id,
      venueName: venue.name,
      locale: venue.locale,
      rendered,
      ticketUrl: ticketLink(visit.public_token),
    });

    // Nothing to send (no opt-in on any transport) → no notifications row.
    if (push.sent === 0 && push.error === null) {
      await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
      return { jobId: job.id, outcome: 'skipped_gate', detail: 'no push targets' };
    }

    await db.from('notifications').insert({
      visit_id: visit.id,
      venue_id: venue.id,
      channel: 'push',
      template_key: job.template_key,
      to_addr: push.detail,
      body: rendered,
      segments: null,
      cost_grosz: 0, // free channel — never debits the wallet
      status: push.ok ? 'sent' : 'failed',
      provider_id: null,
      sent_at: push.ok ? new Date().toISOString() : null,
      error: push.error,
    });

    const state = await finishJob(db, job, push.ok);
    if (state === 'failed') {
      console.error('[send-notification] push failed permanently', {
        jobId: job.id,
        visitId: visit.id,
        error: push.error,
      });
      return { jobId: job.id, outcome: 'failed', detail: push.error ?? 'unknown' };
    }
    return { jobId: job.id, outcome: push.ok ? 'sent' : 'retry', detail: push.error ?? undefined };
  }

  let toAddr: string | null = null;

  if (channel === 'sms') {
    if (!paid || !smsChannelOn) {
      // Page-only degrade: no SMS, drop the job silently (§7.1).
      await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
      return { jobId: job.id, outcome: 'skipped_gate', detail: 'sms not enabled' };
    }
    if (!guest?.phone_e164) {
      await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
      return { jobId: job.id, outcome: 'skipped_gate', detail: 'no phone' };
    }
    if (venue.sms_balance_grosz <= 0) {
      // Silent degrade to page-only + Settings banner (derived from balance).
      await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
      return { jobId: job.id, outcome: 'skipped_gate', detail: 'zero balance' };
    }
    toAddr = guest.phone_e164;
  } else {
    // Email fallback (§7.1) — only when the guest gave an email and channel on.
    if (!emailChannelOn || !guest?.email) {
      await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
      return { jobId: job.id, outcome: 'skipped_gate', detail: 'email not available' };
    }
    toAddr = guest.email;
  }

  // Every gate branch above either assigned a non-null address or early-returned.
  if (toAddr === null) {
    await db.from('notification_jobs').update({ done_at: new Date().toISOString() }).eq('id', job.id);
    return { jobId: job.id, outcome: 'skipped_gate', detail: 'no address' };
  }
  const recipient: string = toAddr;

  // ── render (§7.2, §7.4) ────────────────────────────────────────────────────
  const body = await resolveTemplateBody(db, venue.id, job.template_key, venue.locale);
  const rendered = renderTemplate(body, {
    name: guest?.first_name ?? '',
    venue: venue.name,
    ticket_no: visit.ticket_no,
    hold: venue.settings.hold_minutes ?? 7,
    link: ticketLink(visit.public_token),
    time: formatWarsawTimeSafe(visit.notified_at),
  });

  const analysis = analyze(rendered);

  // ── send + accounting ──────────────────────────────────────────────────────
  if (channel === 'sms') {
    const result = await sendSms({ to: recipient, body: rendered });
    const costGrosz = result.costGrosz ?? 0;

    await db.from('notifications').insert({
      visit_id: visit.id,
      venue_id: venue.id,
      channel: 'sms',
      template_key: job.template_key,
      to_addr: recipient,
      body: rendered,
      segments: result.segments || analysis.segments,
      cost_grosz: result.ok ? costGrosz : null,
      status: result.ok ? 'sent' : 'failed',
      provider_id: result.providerId,
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.error,
    });

    if (result.ok && costGrosz > 0) {
      await debitWallet(db, venue, costGrosz);
    }

    const state = await finishJob(db, job, result.ok);
    if (state === 'failed') {
      console.error('[send-notification] SMS failed permanently', {
        jobId: job.id,
        visitId: visit.id,
        error: result.error,
      });
      return { jobId: job.id, outcome: 'failed', detail: result.error ?? 'unknown' };
    }
    return {
      jobId: job.id,
      outcome: result.ok ? 'sent' : 'retry',
      detail: result.error ?? undefined,
    };
  }

  // email
  const result = await sendEmail({
    to: recipient,
    subject: venue.name,
    text: rendered,
  });

  await db.from('notifications').insert({
    visit_id: visit.id,
    venue_id: venue.id,
    channel: 'email',
    template_key: job.template_key,
    to_addr: recipient,
    body: rendered,
    segments: null,
    cost_grosz: null,
    status: result.ok ? 'sent' : 'failed',
    provider_id: result.providerId,
    sent_at: result.ok ? new Date().toISOString() : null,
    error: result.error,
  });

  const state = await finishJob(db, job, result.ok);
  if (state === 'failed') {
    console.error('[send-notification] email failed permanently', {
      jobId: job.id,
      visitId: visit.id,
      error: result.error,
    });
    return { jobId: job.id, outcome: 'failed', detail: result.error ?? 'unknown' };
  }
  return {
    jobId: job.id,
    outcome: result.ok ? 'sent' : 'retry',
    detail: result.error ?? undefined,
  };
}

/**
 * Debit the prepaid SMS wallet by `costGrosz` and, when it crosses the low
 * threshold, emit an owner alert (best-effort — never blocks the send, §7.1).
 */
async function debitWallet(
  db: SupabaseClient,
  venue: VenueForSend,
  costGrosz: number,
): Promise<void> {
  const before = venue.sms_balance_grosz;
  const after = before - costGrosz;
  await db.from('venues').update({ sms_balance_grosz: after }).eq('id', venue.id);

  if (before > LOW_BALANCE_GROSZ && after <= LOW_BALANCE_GROSZ) {
    // Cross into low-balance: signal (an email is another track's concern).
    console.error('[send-notification] SMS balance low', {
      venueId: venue.id,
      balanceGrosz: after,
    });
  }
}

/**
 * Convenience for `send-notification`: lock a job by id, then process it.
 * Handles the already-claimed / already-done cases idempotently.
 */
export async function runJobById(db: SupabaseClient, jobId: string): Promise<ProcessResult> {
  const locked = await lockJob(db, jobId);
  if (!locked) {
    // Either done, missing, or claimed by another worker — all no-ops for us.
    return { jobId, outcome: 'already_done' };
  }
  return await processLockedJob(db, locked);
}
