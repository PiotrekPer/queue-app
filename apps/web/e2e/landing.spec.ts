import { expect, test } from '@playwright/test';

/**
 * Landing page — apps/web/app/(marketing)/ (§10).
 *
 * Verifies the three load-bearing promises of the hero + pricing + the
 * playable "live mini host-stand" demo (HostStandDemo), which is the single
 * interaction that explains the whole product: tapping `Powiadom` on a fake
 * queue card flips a mini guest ticket to the STOLIK GOTOWY stamp, client-side.
 *
 * Landing copy is hardcoded in the marketing components (not in i18n keys), so
 * the exact spec strings are asserted here verbatim.
 */

const H1 = 'Koniec z kolejką pod drzwiami.';
const PRICE_PRO = '149'; // "Pro 149 zł netto/mc" (§10 §5)
const STAMP = 'STOLIK GOTOWY';
const NOTIFY = 'Powiadom';

test.describe('landing · /', () => {
  test('renders the hero H1', async ({ page }) => {
    await page.goto('/');

    // Exactly one primary headline, and it's the promise.
    await expect(page.getByRole('heading', { name: H1 })).toBeVisible();
  });

  test('pricing shows the 149 zł Pro tier', async ({ page }) => {
    await page.goto('/');

    // "149" appears with "zł" nearby — resilient to "149 zł netto/mc" wording.
    const price = page.getByText(new RegExp(`${PRICE_PRO}\\s*zł`, 'i')).first();
    await expect(price).toBeVisible();
  });

  test('HostStandDemo flips to STOLIK GOTOWY when Powiadom is clicked', async ({ page }) => {
    await page.goto('/');

    // Before interaction, the stamp is not shown in the mini demo.
    await expect(page.getByText(STAMP)).toHaveCount(0);

    // Tap the demo's Powiadom button (there may be one; take the first).
    const notify = page.getByRole('button', { name: new RegExp(NOTIFY, 'i') }).first();
    await expect(notify).toBeVisible();
    await notify.click();

    // The mini guest ticket flips to the STOLIK GOTOWY stamp, fully client-side.
    await expect(page.getByText(STAMP)).toBeVisible();
  });

  test('has the primary "try it free" call to action', async ({ page }) => {
    await page.goto('/');

    // CTA copy from §10 hero: `Wypróbuj za darmo`.
    await expect(
      page.getByRole('link', { name: /Wypróbuj za darmo/i }).first(),
    ).toBeVisible();
  });
});
