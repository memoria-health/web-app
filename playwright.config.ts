import { defineConfig, devices } from '@playwright/test';

// IMPORTANT: We run E2E against a *production build* (`pnpm start`) instead
// of `pnpm dev`. Next.js 16.2.6 + Turbopack currently has a client-side
// hydration regression that prevents React from mounting in dev mode on
// our setup (top-level module code runs, but useEffect/event handlers never
// fire). The same code works fine in `next start`, so we test there.
//
// If you're iterating on UI locally and need fast feedback, run:
//   pnpm build && pnpm start
// instead of `pnpm dev`. Or just run the E2E suite, which builds for you.

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
