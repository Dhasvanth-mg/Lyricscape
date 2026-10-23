import { defineConfig } from '@playwright/test';

// E2E smoke tests run against a production build on a separate port with its own data dir.
//   pnpm build && pnpm test:e2e
// Uses the system Edge by default (no browser download). E2E_CHANNEL=chrome to use Chrome,
// or E2E_CHANNEL=chromium for Playwright's bundled browser (run `npx playwright install chromium` first).
const channel = process.env.E2E_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: channel === 'chromium' ? undefined : channel,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'pnpm exec next start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { LYRICSCAPE_DATA_DIR: '.data-e2e', LYRICSCAPE_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234' },
  },
});
