import { expect, test } from './test';
import { chooseTheme, token } from './helpers';
import { spanish } from '../src/i18n/es';
import { DEFAULT_LOCALE } from '../src/i18n/config';
import { ROUTES } from '../src/shared/navigation';

test('favicon and browser metadata follow application tokens and preferences', async ({ page }) => {
  await page.goto(ROUTES.home);
  await expect(page).toHaveTitle(spanish['app.title']);
  await expect(page.locator('html')).toHaveAttribute('lang', DEFAULT_LOCALE);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', spanish['app.description']);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/app-icon.svg');
  await expect(page.locator('link[rel="preload"][as="font"]')).not.toHaveCount(0);
  const icon = await page.request.get('/app-icon.svg');
  expect(icon.ok()).toBe(true);
  const source = await icon.text();
  expect(source).toContain(token('--accent-brand'));
  expect(source).not.toContain('{{');
  // A first visit follows the device; the browser colour changes with it.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', token('--bg-canvas'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', token('--dark-bg-canvas'));
  // A signed-out visitor flips the theme from the bar on wide screens and from the menu on phones.
  for (const [width, theme] of [[1280, 'light'], [1280, 'dark'], [360, 'light']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await chooseTheme(page, theme);
    const surface = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim());
    expect(surface).toBe(token(theme === 'light' ? '--bg-canvas' : '--dark-bg-canvas'));
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', surface);
  }
});

test('each page names the browser tab and an unknown address names the missing page', async ({ page }) => {
  const named = (key: keyof typeof spanish): string => spanish['app.pageTitle'].replace('{{page}}', spanish[key]).replace('{{app}}', spanish['app.name']);
  await page.goto(ROUTES.alignment);
  await expect(page).toHaveTitle(named('nav.alignment'));
  await page.goto(ROUTES.library);
  await expect(page).toHaveTitle(named('nav.library'));
  await page.goto('/no-such-page');
  await expect(page).toHaveTitle(named('notFound.title'));
});
