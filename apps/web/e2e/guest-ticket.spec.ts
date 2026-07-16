import { expect, test } from '@playwright/test';

/**
 * Guest ticket page — the "numerek" — at /v/{token} (§8, §9.4).
 *
 * These exercise the demo/mock tokens the guest track exposes when no live
 * backend is configured (`hasBackend === false`):
 *   demo-waiting → state 1 (the ticket + live-dot)
 *   demo-ready   → state 2 (STOLIK GOTOWY stamp + 3 action buttons)
 *   demo-seated  → state 4 (Smacznego)
 *   demo-unknown → state 6 (404 numerek)
 *
 * Copy is asserted against the canonical Polish strings from
 * `@stoliq/core` i18n (guest.*), so a copy change in one place fails here.
 * Selectors prefer getByRole/getByText to stay resilient to markup churn.
 */

// Mirrors packages/core i18n `guest.*` (pl). Kept inline so a spec failure
// points at the human-visible string, not an opaque key.
const PL = {
  positionCaption: 'w kolejce',
  aboutMinutesPrefix: 'ok.', // "ok. {{min}} min"
  live: 'na żywo',
  ready: 'STOLIK GOTOWY',
  actionOnWay: 'Już idziemy',
  actionDelay: '+5 minut',
  actionCancel: 'Rezygnujemy',
  seatedTitle: 'Smacznego!',
  notFoundTitle: 'Nie znaleźliśmy tego numerka.',
} as const;

test.describe('guest ticket · /v/{token}', () => {
  test('waiting → shows position, an "ok." wait line, and the live-dot', async ({ page }) => {
    await page.goto('/v/demo-waiting');

    // The position is THE element (§9.4): a numeric position + "w kolejce" caption.
    await expect(page.getByText(PL.positionCaption).first()).toBeVisible();
    // A real, rendered position digit somewhere on the ticket.
    await expect(page.getByText(/\b\d+\b/).first()).toBeVisible();

    // Secondary wait line, rounded + humble: "ok. NN min" (or "już za chwilę").
    await expect(
      page.getByText(new RegExp(`${PL.aboutMinutesPrefix}\\s*\\d+\\s*min|już za chwilę`, 'i')),
    ).toBeVisible();

    // "na żywo" live indicator (the pulsing ready-green dot's label).
    await expect(page.getByText(PL.live)).toBeVisible();

    // The theatrical stamp must NOT be present while still waiting.
    await expect(page.getByText(PL.ready)).toHaveCount(0);
  });

  test('ready → STOLIK GOTOWY stamp and the three guest actions', async ({ page }) => {
    await page.goto('/v/demo-ready');

    // The one theatrical moment.
    await expect(page.getByText(PL.ready)).toBeVisible();

    // The three notified-state actions (§8 state 2). Buttons say what happens (§9.5).
    await expect(page.getByRole('button', { name: PL.actionOnWay })).toBeVisible();
    await expect(page.getByRole('button', { name: PL.actionDelay })).toBeVisible();
    await expect(page.getByRole('button', { name: PL.actionCancel })).toBeVisible();
  });

  test('seated → Smacznego! (page self-archives)', async ({ page }) => {
    await page.goto('/v/demo-seated');

    await expect(page.getByText(new RegExp(PL.seatedTitle, 'i'))).toBeVisible();

    // No live actions once the visit is terminal.
    await expect(page.getByRole('button', { name: PL.actionOnWay })).toHaveCount(0);
  });

  test('unknown token → the not-found numerek', async ({ page }) => {
    await page.goto('/v/demo-unknown');

    await expect(page.getByText(new RegExp(PL.notFoundTitle, 'i'))).toBeVisible();

    // Must not leak an active ticket UI.
    await expect(page.getByText(PL.ready)).toHaveCount(0);
    await expect(page.getByText(PL.live)).toHaveCount(0);
  });
});
