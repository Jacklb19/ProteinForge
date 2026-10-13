import { expect, test } from '@playwright/test';
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
  // A signed-out visitor flips the theme from the bar on wide screens.
  for (const theme of ['light', 'dark'] as const) {
    await chooseTheme(page, theme);
    const surface = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim());
    expect(surface).toBe(token(theme === 'light' ? '--bg-canvas' : '--dark-bg-canvas'));
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', surface);
  }
  // The system choice is offered in the phone menu.
  await page.setViewportSize({ width: 360, height: 900 });
  await chooseTheme(page, 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', token('--bg-canvas'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', token('--dark-bg-canvas'));
});
