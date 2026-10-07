import { expect, test } from '@playwright/test';
import { chooseTheme, token } from './helpers';

test('favicon and browser metadata follow application tokens and preferences', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('ProteinForge — Análisis de proteínas');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Análisis local de secuencias de proteínas.');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/app-icon.svg');
  await expect(page.locator('link[rel="preload"][as="font"]')).not.toHaveCount(0);
  const icon = await page.request.get('/app-icon.svg');
  expect(icon.ok()).toBe(true);
  const source = await icon.text();
  expect(source).toContain(token('--accent-brand'));
  expect(source).not.toContain('{{');
  await page.goto('/settings');
  for (const theme of ['light', 'dark'] as const) {
    await chooseTheme(page, theme);
    const surface = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim());
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', surface);
  }
  await chooseTheme(page, 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', token('--bg-canvas'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', token('--dark-bg-canvas'));
});
