import { expect, test } from './test';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';

// Precache intentionally fetches routes in the background; this regression isolates application load.
test.use({ serviceWorkers: 'block', signedIn: false });

test('the public site and the access pages keep the service transport deferred', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await page.goto(ROUTES.home);
  await expect(page.locator('.stage-hero canvas')).toBeVisible();
  await page.locator('#uses .public-use').first().scrollIntoViewIfNeeded();
  await expect(page.locator('#uses .public-facts').first()).toBeVisible();
  await page.locator('header.site-bar').getByRole('link', { name: spanish['shell.signIn'], exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeVisible();
  // Both development module URLs and production chunk names are covered.
  expect(requested.filter(path => /\/(?:rpc|apiClient|projectApi)[.-]|\/gen\/proteinforge\//.test(path))).toEqual([]);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
