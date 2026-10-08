import { defineConfig } from '@playwright/test';

// `npm run test:e2e` starts Vite and provides the address it actually listens on.
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL is missing; run the suite with `npm run test:e2e`.');
const systemChrome = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : undefined;

// Workers default to Playwright's choice; E2E_WORKERS pins them on busy machines.
const workers = process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : undefined;

export default defineConfig({
  testDir: './e2e',
  workers,
  reporter: 'line',
  timeout: 30_000,
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? systemChrome },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
