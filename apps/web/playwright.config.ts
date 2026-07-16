import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Stoliq web app (guest ticket + landing).
 *
 * Scope (§12.2 golden flows, web-relevant subset):
 *  - guest-ticket.spec.ts — the "numerek" states via mock tokens (§8).
 *  - landing.spec.ts       — hero H1, pricing, the playable HostStandDemo (§10).
 *  - golden-flows.spec.ts  — a documented map of §12.2; backend-only flows are
 *                            test.fixme() so coverage stays honest.
 *
 * Browsers are NOT downloaded in CI — this is a scaffold. `pnpm --filter
 * @stoliq/web e2e` runs it locally once `npx playwright install chromium` has
 * been run. The web tsconfig excludes `e2e/`, so these specs never enter
 * `pnpm typecheck`; Playwright transpiles them itself.
 */
const PORT = 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // One place fails loud rather than many flaky ones.
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Boot the Next dev server for the tests. Reuse a running one locally so the
  // dev loop is fast; always spawn fresh in CI.
  webServer: {
    command: 'pnpm --filter @stoliq/web dev',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
