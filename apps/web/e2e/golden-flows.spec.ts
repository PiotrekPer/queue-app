import { expect, test } from '@playwright/test';

/**
 * §12.2 Golden flows — the web-observable slice.
 *
 * This file is the honest coverage map. Most golden flows are *staff-app*
 * flows (Maestro, apps/staff/.maestro/) or need a live Supabase backend
 * (realtime, seeded RPCs, edge functions). Those are declared here as
 * `test.fixme()` so this file documents WHAT the web should eventually verify
 * without pretending to cover it — running the suite prints them as skipped.
 *
 * The one flow whose web half is coverable today with mock tokens (§12.2 #2,
 * the guest side) is asserted live below; the full cross-device version stays
 * fixme until the backend seed + realtime are wired.
 */

test.describe('§12.2 golden flows — coverage map', () => {
  // #1 Add party (size→skip name→QR) → card appears on second device ≤2s.
  // Staff app (Maestro) + realtime; no web surface.
  test.fixme('#1 add party syncs to a second logged-in device ≤2s', async () => {
    // Requires: two authenticated staff sessions + Supabase realtime on visits.
  });

  // #2 Powiadom → guest page flips to STOLIK GOTOWY → „Już idziemy" → staff card green.
  // The GUEST half of #2 (page shows the stamp + the on-way action) is covered
  // today against the demo-ready mock token; see guest-ticket.spec.ts.
  test('#2 (guest half) ready ticket exposes STOLIK GOTOWY + „Już idziemy"', async ({ page }) => {
    await page.goto('/v/demo-ready');
    await expect(page.getByText('STOLIK GOTOWY')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Już idziemy' })).toBeVisible();
  });

  test.fixme('#2 (full) staff Powiadom drives the live guest page + card turns green', async () => {
    // Requires: seeded venue, staff auth, edge function get-ticket + realtime.
  });

  // #3 Hold expiry: fake clock → card pulses → „Nie przyszli" → terminal + Dziś stats.
  // Staff app + pg_cron/sweep + fake clock; no web surface.
  test.fixme('#3 hold expiry pulses the card and no-show updates Dziś stats', async () => {
    // Requires: staff app, sweep_holds job, seeded data.
  });

  // #4 Guest cancels → staff toast → remaining positions shift correctly.
  // Guest ACTION is web (guest-action edge fn); the staff toast + reorder are app + backend.
  test.fixme('#4 guest cancel shifts remaining positions (needs backend)', async () => {
    // Requires: guest-action edge function + realtime recompute; assert with a
    // second seeded ticket's position decrementing.
  });

  // #5 Skip: 4-party queue, skip #1 → order 2,1,3,4 (rank midpoint verified).
  // Pure staff-app + rank RPC; no web surface (rank.ts unit-tested in core).
  test.fixme('#5 skip re-orders via rank midpoint', async () => {
    // Requires: staff app / RPC. Covered at unit level by packages/core rank.test.ts.
  });

  // #6 Offline: airplane-mode add + seat → outbox flush on reconnect, no dupes.
  // Staff-app outbox; no web surface.
  test.fixme('#6 offline add+seat flushes the outbox with no dupes', async () => {
    // Requires: staff app offline queue.
  });

  // #7 Template editor: adding „ą" flips counter to UCS-2/70 + cost warning.
  // Staff-app Settings screen; no web surface (sms-segments.ts unit-tested in core).
  test.fixme('#7 template editor flips to UCS-2 and warns on „ą"', async () => {
    // Requires: staff app Settings. Segment math covered by core sms-segments.test.ts.
  });
});
