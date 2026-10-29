import { expect, test } from '@playwright/test';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import { ROUTES } from '../src/shared/navigation';

// English arrives as its own chunk. On a slow connection a visitor can reload before it does; the choice
// must already be stored, as continuous integration showed when it was saved only after the download.
const ENGLISH_CATALOG = /\/i18n\/en(\.ts|-[\w-]+\.js)|\/en-[\w-]+\.js/;
const SLOW_CATALOG_MS = 3000;

test('choosing English and reloading before its catalog arrives keeps English', async ({ page }) => {
  let held = 0;
  await page.route(ENGLISH_CATALOG, async (route) => {
    held += 1;
    await new Promise((resolve) => setTimeout(resolve, SLOW_CATALOG_MS));
    await route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(ROUTES.analyze);
  const preferences = page.locator('details.preferences-menu');
  await preferences.locator('summary').click();
  await preferences.getByRole('radio', { name: spanish['settings.english'], exact: true }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: SLOW_CATALOG_MS * 5 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(english['workbench.analyzeTitle']);
  expect(held).toBeGreaterThan(0);
});
