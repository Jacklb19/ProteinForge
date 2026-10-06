import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const sequence = 'ACDEFGHIKLMNPQRSTVWY';

test('sidebar stays flush with the viewport edge on wide screens', async ({ page }) => {
  for (const width of [1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const route of ['/', '/alignment', '/settings']) {
      await page.goto(route);
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        const layout = await page.evaluate(() => {
          const header = document.querySelector('.site-header');
          const content = document.querySelector('.workspace-content');
          if (!header || !content) throw new Error('Missing application frame.');
          const styles = getComputedStyle(document.documentElement);
          const sidebarWidth = Number.parseFloat(styles.getPropertyValue('--width-sidebar'));
          return { left: header.getBoundingClientRect().left, width: header.getBoundingClientRect().width,
            contentLeft: content.getBoundingClientRect().left, contentWidth: content.getBoundingClientRect().width,
            sidebarWidth, contentLimit: Number.parseFloat(styles.getPropertyValue('--width-page-max')) - sidebarWidth };
        });
        expect(layout.left).toBe(0);
        expect(layout.width).toBe(layout.sidebarWidth);
        expect(layout.contentLeft).toBe(layout.sidebarWidth);
        expect(layout.contentWidth).toBeLessThanOrEqual(layout.contentLimit);
        await assertFits(page);
        if (width === 1920 && route === '/alignment' && theme === 'dark') {
          await page.screenshot({ path: 'artifacts/sidebar-v2-dark-1920.png' });
        }
      }
    }
  }
});

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
