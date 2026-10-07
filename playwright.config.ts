import { defineConfig } from '@playwright/test';

// `npm run test:e2e` starts Vite and provides the address it actually listens on.
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL is missing; run the suite with `npm run test:e2e`.');
const systemChrome = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : undefined;

export default defineConfig({
  testDir: './e2e',
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
