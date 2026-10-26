import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'pwa-upgrade.check.ts',
  workers: 1,
  reporter: 'line',
  timeout: 120_000,
  use: { browserName: 'webkit', serviceWorkers: 'allow', navigationTimeout: 30_000, actionTimeout: 30_000, viewport: { width: 1280, height: 900 } },
});
