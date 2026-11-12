import { defineConfig } from '@playwright/test';

/*
 * Two Playwright projects:
 *   mocked - every /api call is intercepted in the browser; no backend needed. Proves frontend behaviour only.
 *   real   - needs the real backend on :3000 and its database (see TEST_PLAN.md). Proves real integration.
 *
 * Browser: by default Playwright's own Chromium. If it cannot be downloaded (restricted network) set
 * PW_CHROMIUM_PATH to any Chromium binary. The camera flags below make Chromium provide a SYNTHETIC
 * camera/microphone: this exercises the browser APIs but is NOT a physical camera.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-artifacts/playwright-output',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-artifacts/playwright-results.json' }], ['html', { outputFolder: 'test-artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['camera', 'microphone'],
    launchOptions: {
      executablePath,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'],
    },
  },
  projects: [
    { name: 'mocked', testDir: './tests/e2e/mocked' },
    { name: 'real', testDir: './tests/e2e/real' },
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 90_000,
  },
});
