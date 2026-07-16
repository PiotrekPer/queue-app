/**
 * The scheduled sweep bodies (§7.6), factored out of the HTTP handler so they
 * are individually testable and reusable:
 *
 *  - sweepJobs      — process due `notification_jobs` (§7.6 sweep_jobs / 15s)
 *  - sweepHolds     — fire `hold_expired` for notified visits past their hold
 *                     deadline (§7.6 sweep_holds / 60s, §5 #7)
 *  - sweepHeadsUp   — evaluate trigger #3 and enqueue `heads_up` jobs
 *                     (§7.6 sweep_heads_up / 60s, §5 #3, §6)
 *
 * All are idempotent: a `hold_expired` is fired at most once per notified cycle
 * (guarded by the absence of a later `hold_expired`/`renotified` event since the
 * last `notified_at`); heads-up is guarded by `heads_up_sent_at`.
 */
import {
  ACTIVE_STATUSES,
  computePosition,
  elapsedMinutes,
  headsUpEta,
  LIMITS,
  median,
  shouldSendHeadsUp,
  type Locale,
} from '@stoliq/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { processLockedJob, selectDueJobs, lockJob, type ProcessResult } from './jobs.ts';

export interface SweepReport {
  jobs: ProcessResult[];
  holdsExpired: number;
  headsUpEnqueued: number;
}

// ── 1. jobs ─────────────────────────────────────────────────────────────────

/** Lock + process each due job. Concurrent-safe via per-row lock (§7.4). */
export async function sweepJobs(db: SupabaseClient, limit = 50): Promise<ProcessResult[]> {
  const due = await selectDueJobs(db, limit);
  const results: ProcessResult[] = [];
  for (const candidate of due) {
    const locked = await lockJob(db, candidate.id);
    if (!locked) {
      results.push({ jobId: candidate.id, outcome: 'already_done' });
      continue;
    }
    results.push(await processLockedJob(db, locked));
  }
  return results;
}

// ── 2. holds ────────────────────────────────────────────────────────────────

interface NotifiedVisit {
  id: string;
  venue_id: string;
  notified_at: string | null;
  hold_expires_at: string | null;
}

/**
 * Fire a `hold_expired` event for every notified visit whose hold deadline has
 * passed and which has not already expired/renotified this cycle (§5 #7). The
 * card's pulsing UI state is derived by the staff app from this event; no status
 * change and no notification here.
 */
export async function sweepHolds(db: SupabaseClient): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('visits')
    .select('id, venue_id, notified_at, hold_expires_at')
    .eq('status', 'notified')
    .not('hold_expires_at', 'is', null)
    .lte('hold_expires_at', nowIso);
  if (error) throw error;

  const visits = (data ?? []) as NotifiedVisit[];
  let fired = 0;

  for (const visit of visits) {
    if (await alreadyExpiredThisCycle(db, visit)) continue;

    await db.from('visit_events').insert({
      visit_id: visit.id,
      venue_id: visit.venue_id,
      actor: 'system',
      event: 'hold_expired',
      meta: {},
    });
    fired += 1;
  }
  return fired;
}

/**
 * True when a `hold_expired` (or `renotified`, which starts a fresh hold) has
 * already been logged at/after the current `notified_at`. Keeps the sweep from
 * re-firing the same expiry every 60s.
 */
async function alreadyExpiredThisCycle(
  db: SupabaseClient,
  visit: NotifiedVisit,
): Promise<boolean> {
  const since = visit.notified_at ?? new Date(0).toISOString();
  const { count, error } = await db
    .from('visit_events')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visit.id)
    .in('event', ['hold_expired', 'renotified'])
    .gte('created_at', since);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ── 3. heads-up (trigger #3) ──────────────────────────────────────────────────

interface VenueLite {
  id: string;
  plan: string;
  locale: Locale;
  settings: {
    heads_up_position?: number;
    heads_up_eta_minutes?: number;
    channels?: { sms?: boolean };
  };
}

interface ActiveVisit {
  id: string;
  venue_id: string;
  guest_id: string | null;
  status: string;
  party_size: number;
  rank: number;
  heads_up_sent_at: string | null;
}

/**
 * Evaluate the heads-up trigger (#3) across every venue with an active queue and
 * enqueue a `heads_up` SMS job for each eligible party (position ≤ threshold OR
 * live ETA ≤ threshold, phone present, unsent, paid plan). Also called inline
 * after every seating in the staff pipeline; here it is the 60s safety net.
 */
export async function sweepHeadsUp(db: SupabaseClient): Promise<number> {
  const venues = await loadPaidVenuesWithQueue(db);
  let enqueued = 0;

  for (const venue of venues) {
    const paid = venue.plan === 'pro' || venue.plan === 'suite';
    const smsOn = venue.settings.channels?.sms !== false;
    if (!paid || !smsOn) continue;

    const active = await loadActiveVisits(db, venue.id);
    if (active.length === 0) continue;

    const ranks = active.map((v) => v.rank);
    const medianInterval = await medianSeatIntervalAll(db, venue.id);

    for (const visit of active) {
      if (visit.heads_up_sent_at) continue;
      if (!visit.guest_id) continue;

      const phone = await guestHasPhone(db, visit.guest_id);
      if (!phone) continue;

      const position = computePosition(visit.rank, ranks);
      const eta = headsUpEta(position, medianInterval);

      const eligible = shouldSendHeadsUp({
        position,
        etaMinutes: eta,
        headsUpPosition: venue.settings.heads_up_position ?? 2,
        headsUpEtaMinutes: venue.settings.heads_up_eta_minutes ?? 8,
        phonePresent: true,
        headsUpAlreadySent: false,
        paidPlan: true,
      });
      if (!eligible) continue;

      // Mark first to make this idempotent under concurrent sweeps, then enqueue.
      const marked = await markHeadsUpSent(db, visit.id);
      if (!marked) continue;

      await db.from('notification_jobs').insert({
        visit_id: visit.id,
        template_key: 'heads_up',
        channel: 'sms',
        run_after: new Date().toISOString(),
        attempts: 0,
      });
      await db.from('visit_events').insert({
        visit_id: visit.id,
        venue_id: venue.id,
        actor: 'system',
        event: 'heads_up',
        meta: { position, eta_minutes: eta },
      });
      enqueued += 1;
    }
  }
  return enqueued;
}

async function loadPaidVenuesWithQueue(db: SupabaseClient): Promise<VenueLite[]> {
  const { data, error } = await db
    .from('venues')
    .select('id, plan, locale, settings')
    .in('plan', ['pro', 'suite']);
  if (error) throw error;
  return (data ?? []) as VenueLite[];
}

async function loadActiveVisits(db: SupabaseClient, venueId: string): Promise<ActiveVisit[]> {
  const { data, error } = await db
    .from('visits')
    .select('id, venue_id, guest_id, status, party_size, rank, heads_up_sent_at')
    .eq('venue_id', venueId)
    .in('status', ACTIVE_STATUSES as unknown as string[])
    .order('rank', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ActiveVisit[];
}

async function guestHasPhone(db: SupabaseClient, guestId: string): Promise<boolean> {
  const { data, error } = await db
    .from('guests')
    .select('phone_e164')
    .eq('id', guestId)
    .maybeSingle();
  if (error) throw error;
  return Boolean((data as { phone_e164: string | null } | null)?.phone_e164);
}

/**
 * Set `heads_up_sent_at` only if it is still null (compare-and-set). Returns true
 * when this worker won the race — prevents double heads-up under concurrency.
 */
async function markHeadsUpSent(db: SupabaseClient, visitId: string): Promise<boolean> {
  const { data, error } = await db
    .from('visits')
    .update({ heads_up_sent_at: new Date().toISOString() })
    .eq('id', visitId)
    .is('heads_up_sent_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Median of recent seat-to-seat intervals across ALL brackets for a venue (§6),
 * used as the per-position ETA factor for heads-up. Uses the trailing seating
 * timestamps; returns null when there is not enough history.
 */
async function medianSeatIntervalAll(
  db: SupabaseClient,
  venueId: string,
): Promise<number | null> {
  const windowStart = new Date(
    Date.now() - LIMITS.seatSampleWindowMinutes * 60_000,
  ).toISOString();
  const { data, error } = await db
    .from('visits')
    .select('seated_at')
    .eq('venue_id', venueId)
    .eq('status', 'seated')
    .not('seated_at', 'is', null)
    .gte('seated_at', windowStart)
    .order('seated_at', { ascending: true })
    .limit(LIMITS.seatSampleCount + 1);
  if (error) throw error;

  const seatedAts = ((data ?? []) as Array<{ seated_at: string }>).map((r) => r.seated_at);
  if (seatedAts.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < seatedAts.length; i++) {
    intervals.push(elapsedMinutes(seatedAts[i - 1] as string, seatedAts[i] as string));
  }
  return intervals.length > 0 ? median(intervals) : null;
}

// ── orchestration ─────────────────────────────────────────────────────────────

/** Run all three sweeps in order and return a combined report (§7.6). */
export async function runAllSweeps(db: SupabaseClient): Promise<SweepReport> {
  const jobs = await sweepJobs(db);
  const holdsExpired = await sweepHolds(db);
  const headsUpEnqueued = await sweepHeadsUp(db);
  return { jobs, holdsExpired, headsUpEnqueued };
}
