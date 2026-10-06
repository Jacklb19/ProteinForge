import { expect, test } from '@playwright/test';

test('favicon and browser metadata follow application tokens and preferences', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('ProteinForge — Análisis de proteínas');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Análisis local de secuencias de proteínas.');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/app-icon.svg');
  const icon = await page.request.get('/app-icon.svg');
  expect(icon.ok()).toBe(true);
  const source = await icon.text();
  expect(source).toContain('#9a3e16');
  expect(source).not.toContain('{{');
  await page.goto('/settings');
  for (const theme of ['light', 'dark'] as const) {
    await page.getByRole('combobox', { name: 'Tema' }).selectOption(theme);
    const surface = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim());
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', surface);
  }
  await page.getByRole('combobox', { name: 'Tema' }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#fffef9');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1c211e');
});
