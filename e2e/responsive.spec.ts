import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { assertFits, chooseTheme, followNavigation, openSequenceEditor, residueReader } from './helpers';
import { spanish } from '../src/i18n/es';
import { NAVIGATION_ITEMS, ROUTES } from '../src/shared/navigation';

const sequence = 'ACDEFGHIKLMNPQRSTVWY';

/** The library requests public coordinates on arrival; they are answered locally. */
async function serveStructure(page: Page): Promise<void> {
  await page.route('https://models.rcsb.org/**', (route) => route.fulfill({
    path: 'e2e/fixtures/1TRZ.bcif', contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' },
  }));
}

test('the laboratory frame fits every destination on wide screens and phones', async ({ page }) => {
  // Thirty page and theme combinations: allow the longer budget slower runners need.
  test.slow();
  await serveStructure(page);
  for (const width of [360, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const item of NAVIGATION_ITEMS.filter(item => !item.signedInOnly)) {
      await page.goto(item.path);
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        const sidebar = page.locator('.workspace-sidebar');
        const bar = page.locator(width === 360 ? 'header.workspace-bar' : '.workspace-sidebar');
        expect(await bar.evaluate(element => element.getBoundingClientRect().top)).toBe(0);
        if (width === 360) {
          await expect(sidebar).toBeHidden();
          await expect(page.getByRole('button', { name: spanish['shell.openMenu'] })).toBeVisible();
        } else {
          await expect(sidebar).toBeVisible();
          await expect(page.getByRole('button', { name: spanish['shell.openMenu'] })).toBeHidden();
          await expect(sidebar.locator('[aria-current="page"]')).toHaveAttribute('href', item.path);
          await expect(sidebar.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link')).toHaveText(NAVIGATION_ITEMS.filter(entry => !entry.signedInOnly).map(entry => spanish[entry.labelKey]));
          const boxes = await page.evaluate(() => {
            const sidebar = document.querySelector('.workspace-sidebar'), content = document.querySelector('.workspace-body');
            if (!sidebar || !content) throw new Error('Missing workspace frame.');
            return { sidebar: sidebar.getBoundingClientRect().right, content: content.getBoundingClientRect().left };
          });
          expect(boxes.sidebar).toBeLessThanOrEqual(boxes.content);
        }
        await assertFits(page);
      }
    }
  }
});

for (const width of [360, 768, 1280, 1440] as const) {
  test(`main sequence flow fits a ${String(width)}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.analyze);
    await (await openSequenceEditor(page)).fill(sequence);
    await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
    await expect(residueReader(page)).toBeVisible();
    await page.getByRole('tab', { name: spanish['workbench.summary'], exact: true }).click();
    await expect(page.getByText(spanish['descriptors.mass'], { exact: true })).toBeVisible();
    await expect(page.getByText(spanish['editor.noInvalid'])).toBeVisible();
    await page.getByRole('tab', { name: spanish['workbench.profile'], exact: true }).click();
    await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      // The theme is chosen from Preferences, and a public page is visited before coming back to the draft.
      await chooseTheme(page, theme);
      await page.getByRole('navigation', { name: spanish['footer.navigation'] }).getByRole('link', { name: spanish['nav.privacy'], exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['privacy.title']);
      await assertFits(page);
      await page.getByRole('navigation', { name: spanish['footer.navigation'] }).getByRole('link', { name: spanish['public.laboratory'], exact: true }).click();
      await followNavigation(page, spanish['nav.analyze']);
      await expect(page.getByRole('heading', { level: 2, name: spanish['editor.ownTitle'], exact: true })).toBeVisible();
      await expect(await openSequenceEditor(page)).toHaveValue(sequence);
      await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
      await expect(residueReader(page)).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: `artifacts/${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
