import { defineConfig } from '@playwright/test';

// `npm run test:e2e` starts Vite and provides the address it actually listens on.
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL is missing; run the suite with `npm run test:e2e`.');
const systemChrome = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : undefined;

// E2E_WORKERS pins the count on busy machines. Continuous integration runs one worker: a shared runner
// has few cores, and these flows (several widths, axe, WASM and the structure viewer) miss the per-test
// budget when they compete for the same CPU. Elsewhere Playwright decides.
const workers = process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : process.env.CI ? 1 : undefined;
const browserName = process.env.E2E_BROWSER ?? 'chromium';
if (browserName !== 'chromium' && browserName !== 'firefox' && browserName !== 'webkit') {
  throw new Error('E2E_BROWSER must be chromium, firefox or webkit.');
}

export default defineConfig({
  testDir: './e2e',
  workers,
  // In continuous integration a failure also becomes a check annotation with the test and its error,
  // which anyone can read on GitHub; the step log itself needs a signed-in account.
  reporter: process.env.CI ? [['github'], ['line']] : 'line',
  timeout: 30_000,
  use: {
    baseURL,
    browserName,
    // General flows use mocked services; the dedicated check:pwa script exercises real caching.
    serviceWorkers: 'block',
    launchOptions: browserName === 'chromium'
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? systemChrome }
      : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
