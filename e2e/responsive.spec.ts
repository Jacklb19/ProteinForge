import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseTheme } from './helpers';

const sequence = 'ACDEFGHIKLMNPQRSTVWY';

test('top bar stays centered on wide screens and becomes a tab bar on phones', async ({ page }) => {
  for (const width of [360, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const route of ['/', '/alignment', '/settings']) {
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

async function assertFits(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    controls: [...document.querySelectorAll('button, select, input[type="file"], a, .segmented-option, summary')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => ({ label: element.textContent.trim() || element.tagName,
        height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width })),
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.controls.filter((control) => control.height < 44 || control.width < 44)).toEqual([]);
}

for (const width of [360, 768, 1280, 1440] as const) {
  test(`main sequence flow fits a ${String(width)}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('textbox', { name: /secuencia de aminoácidos/i }).fill(sequence);
    await expect(page.getByRole('group', { name: /Secuencia numerada/ })).toBeVisible();
    await expect(page.getByText(/masa molecular/i)).toBeVisible();
    await expect(page.getByText('No hay posiciones inválidas.')).toBeVisible();
    await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      await page.getByRole('link', { name: 'Ajustes' }).click();
      await chooseTheme(page, theme);
      await assertFits(page);
      await page.getByRole('link', { name: 'Analizar', exact: true }).click();
      await expect(page.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue(sequence);
      await expect(page.getByRole('group', { name: /Secuencia numerada/ })).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: `artifacts/${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
