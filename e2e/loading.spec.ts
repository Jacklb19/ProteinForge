import { expect, test } from '@playwright/test';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { followNavigation } from './helpers';

// Precache intentionally fetches routes in the background; this regression isolates application load.
test.use({ serviceWorkers: 'block' });

test('anonymous analysis keeps the service transport deferred until a service is used', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await page.goto(ROUTES.home);
  await expect(page.locator('.view-fact')).toBeVisible();
  await followNavigation(page, spanish['nav.analyze']);
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  // Both development module URLs and production chunk names are covered.
  expect(requested.filter(path => /\/(?:rpc|apiClient|projectApi)[.-]|\/gen\/proteinforge\//.test(path))).toEqual([]);
  await followNavigation(page, spanish['nav.alignment']);
  await expect(page.locator('.verdict')).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
