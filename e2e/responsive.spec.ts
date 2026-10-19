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

test('the site bar fits every primary destination on wide screens and phones', async ({ page }) => {
  // Thirty page and theme combinations: allow the longer budget slower runners need.
  test.slow();
  await serveStructure(page);
  for (const width of [360, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const item of NAVIGATION_ITEMS.filter(item => !item.signedInOnly)) {
      await page.goto(item.path);
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        const layout = await page.evaluate(() => {
          const bar = document.querySelector('header.site-bar')?.getBoundingClientRect();
          const inner = document.querySelector('.site-bar-inner')?.getBoundingClientRect();
          const brand = document.querySelector('.site-bar .brand')?.getBoundingClientRect();
          const end = document.querySelector('.site-bar-end')?.getBoundingClientRect();
          const navigation = document.querySelector('.site-bar nav');
          if (!bar || !inner || !brand || !end || !navigation) throw new Error('Missing application frame.');
          return {
            barTop: bar.top, barLeft: bar.left, barRight: innerWidth - bar.right,
            left: inner.left, right: innerWidth - inner.right, brandRight: brand.right, endLeft: end.left, endRight: end.right,
            navigationShown: navigation.getClientRects().length > 0,
            current: [...navigation.querySelectorAll('[aria-current="page"]')].map((link) => link.getAttribute('href')),
            docks: document.querySelectorAll('.primary-navigation, .dock-actions').length,
          };
        });
        // One sticky bar across the top; the former bottom tab bar and floating dock are gone.
        expect(layout.barTop).toBe(0);
        expect(layout.barLeft).toBe(0);
        expect(layout.barRight).toBe(0);
        expect(layout.docks).toBe(0);
        expect(layout.current).toEqual([item.path]);
        expect(layout.brandRight).toBeLessThanOrEqual(layout.endLeft);
        expect(Math.abs(layout.left - layout.right)).toBeLessThanOrEqual(1);
        expect(layout.endRight).toBeLessThanOrEqual(width);
        if (width === 360) {
          expect(layout.navigationShown).toBe(false);
          await expect(page.getByRole('button', { name: spanish['shell.openMenu'] })).toBeVisible();
        } else {
          expect(layout.navigationShown).toBe(true);
          await expect(page.getByRole('button', { name: spanish['shell.openMenu'] })).toBeHidden();
          await expect(page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link')).toHaveText(NAVIGATION_ITEMS.filter(item => !item.signedInOnly).map((entry) => spanish[entry.labelKey]));
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
    await expect(residueReader(page)).toBeVisible();
    await expect(page.getByText(spanish['descriptors.mass'], { exact: true })).toBeVisible();
    await expect(page.getByText(spanish['editor.noInvalid'])).toBeVisible();
    await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      // The theme is chosen from the shell, and a secondary page is visited before coming back to the draft.
      await chooseTheme(page, theme);
      await page.getByRole('navigation', { name: spanish['footer.navigation'] }).getByRole('link', { name: spanish['nav.privacy'], exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['privacy.title']);
      await assertFits(page);
      await followNavigation(page, spanish['nav.analyze']);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['editor.ownTitle']);
      await expect(await openSequenceEditor(page)).toHaveValue(sequence);
      await expect(residueReader(page)).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: `artifacts/${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
