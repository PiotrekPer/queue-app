/**
 * purge-guests (§7.6 purge_guests / daily 04:00, §11) — RODO auto-purge.
 *
 * POST (no body). For every guest whose `purge_after` date has passed:
 *  - anonymize `visits.display_name` → 'Gość' on that guest's visits (keeps the
 *    row + its events/notifications for analytics, but strips the PII name);
 *  - hard-DELETE the guest row (removing phone/email/first_name/consent).
 *
 * We deliberately keep `visit_events` and `notifications` (their meta is non-PII;
 * `notifications.to_addr` is the only PII-ish field and is scrubbed alongside).
 * Idempotent: re-running finds no due guests once purged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json } from '../_shared/cors.ts';

/** Anonymized display name after purge (§11). */
const ANON_NAME = 'Gość';

interface DueGuest {
  id: string;
  venue_id: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(errorBody('method_not_allowed'), 405);
  }

  try {
    const db = adminClient();
    const report = await purgeExpiredGuests(db);
    return json({ ok: true, ...report }, 200);
  } catch (err) {
    console.error('[purge-guests] error', err);
    return json(errorBody('internal_error'), 500);
  }
});

export interface PurgeReport {
  guests_deleted: number;
  visits_anonymized: number;
  notifications_scrubbed: number;
}

/**
 * The purge body, exported for reuse/testing. Uses today's Warsaw date as the
 * cutoff (`purge_after` is a date column; retention counts in calendar days).
 */
export async function purgeExpiredGuests(db: SupabaseClient): Promise<PurgeReport> {
  const today = todayDateKey();

  const { data, error } = await db
    .from('guests')
    .select('id, venue_id')
    .lte('purge_after', today);
  if (error) throw error;

  const due = (data ?? []) as DueGuest[];
  let visitsAnonymized = 0;
  let notificationsScrubbed = 0;

  for (const guest of due) {
    // 1. Anonymize the display name on this guest's visits (keep the rows).
    const { data: visits, error: vErr } = await db
      .from('visits')
      .update({ display_name: ANON_NAME })
      .eq('guest_id', guest.id)
      .neq('display_name', ANON_NAME)
      .select('id');
    if (vErr) throw vErr;
    const visitIds = ((visits ?? []) as Array<{ id: string }>).map((v) => v.id);
    visitsAnonymized += visitIds.length;

    // 2. Scrub the recipient address from notifications tied to those visits.
    if (visitIds.length > 0) {
      const { data: notifs, error: nErr } = await db
        .from('notifications')
        .update({ to_addr: ANON_NAME })
        .in('visit_id', visitIds)
        .neq('to_addr', ANON_NAME)
        .select('id');
      if (nErr) throw nErr;
      notificationsScrubbed += ((notifs ?? []) as Array<{ id: string }>).length;
    }

    // 3. Detach the guest from its visits so the FK delete is clean, then delete.
    if (visitIds.length > 0) {
      const { error: dErr } = await db
        .from('visits')
        .update({ guest_id: null })
        .eq('guest_id', guest.id);
      if (dErr) throw dErr;
    }
    const { error: delErr } = await db.from('guests').delete().eq('id', guest.id);
    if (delErr) throw delErr;
  }

  return {
    guests_deleted: due.length,
    visits_anonymized: visitsAnonymized,
    notifications_scrubbed: notificationsScrubbed,
  };
}

/** Local calendar date „YYYY-MM-DD" for the purge cutoff. */
function todayDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Warsaw',
  }).format(new Date());
}
