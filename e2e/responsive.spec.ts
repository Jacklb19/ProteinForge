import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const sequence = 'ACDEFGHIKLMNPQRSTVWY';

async function assertFits(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    controls: [...document.querySelectorAll('button, select, input[type="file"], a')]
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
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText(/masa molecular/i)).toBeVisible();
    await expect(page.getByText('No hay posiciones inválidas.')).toBeVisible();
    await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      await page.goto('/settings');
      await page.getByRole('combobox', { name: 'Tema' }).selectOption(theme);
      await assertFits(page);
      await page.goto('/');
      await page.getByRole('textbox', { name: /secuencia de aminoácidos/i }).fill(sequence);
      await expect(page.getByRole('table')).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: `artifacts/${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
