import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';
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
