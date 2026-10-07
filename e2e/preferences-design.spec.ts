import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chooseTheme, token } from './helpers';

test('preferences fit both widths and themes with accessible controls', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings');
    for (const theme of ['light', 'dark'] as const) {
      await chooseTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByText(/catálogo en inglés está pendiente/)).toBeVisible();
      const dimensions = await page.evaluate(() => ({ overflow: document.body.scrollWidth - innerWidth,
        targets: [...document.querySelectorAll('a, button, .segmented-option')].filter((element) => element.getClientRects().length > 0)
          .map((element) => { const bounds = element.getBoundingClientRect(); return [bounds.width, bounds.height]; }),
      }));
      expect(dimensions.overflow).toBeLessThanOrEqual(0);
      for (const target of dimensions.targets) { expect(target[0]).toBeGreaterThanOrEqual(44); expect(target[1]).toBeGreaterThanOrEqual(44); }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/settings-${theme}-${String(width)}.png`, fullPage: true });
    }
  }
});

test('system theme and pending English preserve layout and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/settings');
  await chooseTheme(page, 'system');
  const system = page.getByRole('radio', { name: 'Sistema' });
  await system.focus();
  await system.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Claro' })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await system.focus();
  await chooseTheme(page, 'system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim())).toBe(token('--dark-bg-canvas'));
  await page.getByRole('radio', { name: 'English' }).check();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('[EN pending]');
  expect(await page.evaluate(() => document.body.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'artifacts/settings-pending-english-360.png', fullPage: true });
});
