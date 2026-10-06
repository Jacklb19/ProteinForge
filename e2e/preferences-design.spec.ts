import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('preferences fit both widths and themes with accessible controls', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings');
    for (const theme of ['light', 'dark'] as const) {
      await page.getByRole('combobox', { name: 'Tema' }).selectOption(theme);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByText(/catálogo en inglés está pendiente/)).toBeVisible();
      const dimensions = await page.evaluate(() => ({ overflow: document.body.scrollWidth - innerWidth,
        targets: [...document.querySelectorAll('select, a')].map((element) => {
          const bounds = element.getBoundingClientRect(); return [bounds.width, bounds.height];
        }),
      }));
      expect(dimensions.overflow).toBeLessThanOrEqual(0);
      for (const target of dimensions.targets) { expect(target[0]).toBeGreaterThanOrEqual(44); expect(target[1]).toBeGreaterThanOrEqual(44); }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/settings-v2-${theme}-${String(width)}.png`, fullPage: true });
    }
  }
});

test('system theme and pending English preserve layout and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/settings');
  const theme = page.getByRole('combobox', { name: 'Tema' });
  await theme.selectOption('system');
  await theme.focus();
  await theme.press('Tab');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim())).toBe('#141715');
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('[EN pending]');
  expect(await page.evaluate(() => document.body.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'artifacts/settings-v2-pending-english-360.png', fullPage: true });
});
