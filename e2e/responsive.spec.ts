import { expect, test } from '@playwright/test';
import { assertFits, chooseTheme, navigationLink } from './helpers';
import { spanish } from '../src/i18n/es';
import { NAVIGATION_ITEMS, ROUTES } from '../src/shared/navigation';

const sequence = 'ACDEFGHIKLMNPQRSTVWY';

test('top bar stays centered on wide screens and becomes a tab bar on phones', async ({ page }) => {
  for (const width of [360, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const route of NAVIGATION_ITEMS.map((item) => item.path)) {
      await page.goto(route);
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        const layout = await page.evaluate(() => {
          const bar = document.querySelector('.top-bar')?.getBoundingClientRect();
          const navigation = document.querySelector('.primary-navigation')?.getBoundingClientRect();
          const current = document.querySelector('.primary-navigation [aria-current="page"]');
          if (!bar || !navigation || !current) throw new Error('Missing application frame.');
          return { left: bar.left, right: innerWidth - bar.right, navigationBottom: navigation.bottom, viewportHeight: innerHeight };
        });
        if (width === 360) expect(layout.navigationBottom).toBe(layout.viewportHeight);
        else expect(Math.abs(layout.left - layout.right)).toBeLessThanOrEqual(1);
        await assertFits(page);
      }
    }
  }
});

for (const width of [360, 768, 1280, 1440] as const) {
  test(`main sequence flow fits a ${String(width)}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.analyze);
    await page.getByRole('textbox', { name: /secuencia de aminoácidos/i }).fill(sequence);
    await expect(page.getByRole('group', { name: /Secuencia numerada/ })).toBeVisible();
    await expect(page.getByText(/masa molecular/i)).toBeVisible();
    await expect(page.getByText('No hay posiciones inválidas.')).toBeVisible();
    await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      await navigationLink(page, spanish['nav.settings']).click();
      await chooseTheme(page, theme);
      await assertFits(page);
      await navigationLink(page, spanish['nav.analyze']).click();
      await expect(page.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue(sequence);
      await expect(page.getByRole('group', { name: /Secuencia numerada/ })).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: `artifacts/${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
