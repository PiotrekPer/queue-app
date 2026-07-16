/**
 * sweep-timers (§7.6) — the scheduled tick, safe to run every 15–60s via pg_cron
 * (or an external cron pinging this endpoint). Runs the three sweeps inline:
 *
 *  1. process due `notification_jobs`  (sweep_jobs, §7.4)
 *  2. fire `hold_expired` events        (sweep_holds, §5 #7)
 *  3. evaluate heads-up trigger #3      (sweep_heads_up, §5 #3, §6)
 *
 * POST (no body required). Returns a small report for observability. Idempotent
 * on repeated invocations (each sweep guards against re-firing).
 */
import { adminClient } from '../_shared/admin.ts';
import { errorBody, json } from '../_shared/cors.ts';
import { runAllSweeps } from '../_shared/sweeps.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(errorBody('method_not_allowed'), 405);
  }

  try {
    const db = adminClient();
    const report = await runAllSweeps(db);
    return json(
      {
        ok: true,
        jobs_processed: report.jobs.length,
        holds_expired: report.holdsExpired,
        heads_up_enqueued: report.headsUpEnqueued,
      },
      200,
    );
  } catch (err) {
    console.error('[sweep-timers] error', err);
    return json(errorBody('internal_error'), 500);
  }
});
