import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { assertFits, navigationLink } from './helpers';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import references from '../src/features/descriptors/fixtures/protparam.json' with { type: 'json' };

for (const width of [360, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`friendly workspace fits ${String(width)}px and passes AA in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTES.workspace);
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await expect(page.getByRole('heading', { level: 1, name: spanish['workspace.title'] })).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(spanish['workspace.analyzeTitle']) })).toBeVisible();
      await assertFits(page);
      const header = await page.evaluate(() => {
        const brand = document.querySelector('.top-bar .brand')?.getBoundingClientRect();
        const actions = document.querySelector('.dock-actions')?.getBoundingClientRect();
        if (!brand || !actions) throw new Error('Missing workspace masthead.');
        return { brandRight: brand.right, actionsLeft: actions.left };
      });
      expect(header.brandRight).toBeLessThanOrEqual(header.actionsLeft);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `artifacts/workspace-${theme}-${String(width)}.png`, fullPage: true });
      await page.screenshot({ path: `artifacts/workspace-preview-${theme}-${String(width)}.png` });
    });
  }
}

test('first visit opens the example, explains results, exports them and resumes the real draft', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.locator('.hero-actions').getByRole('link', { name: spanish['landing.primaryAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.workspace}$`));
  await page.getByRole('button', { name: spanish['workspace.tryExample'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByText(spanish['guide.mass'])).toBeVisible();
  const exportButton = page.getByRole('button', { name: spanish['report.download'] });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('The exported CSV is missing.');
  const csv = await readFile(path, 'utf8');
  expect(csv).toContain('"sequence","MALWMRLL');
  const reference = references.find((entry) => entry.accession === 'P01308');
  if (!reference) throw new Error('The insulin reference is missing.');
  const exportedMass = Number(csv.match(/"massDa","([\d.]+)"/)?.[1]);
  expect(Math.abs(exportedMass - reference.massDa)).toBeLessThanOrEqual(0.1);
  await navigationLink(page, spanish['workspace.nav']).click();
  await expect(page.getByRole('heading', { level: 1, name: spanish['workspace.returnTitle'] })).toBeVisible();
  await page.getByRole('link', { name: spanish['workspace.continue'] }).click();
  await expect(page.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue(/^MALWMRLL/);
  await page.getByRole('textbox', { name: /secuencia de aminoácidos/i }).fill('AC-DE');
  await expect(exportButton).toBeDisabled();
});

test('workspace reduced motion keeps the guide and all task controls visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.workspace);
  expect(await page.locator('.task-launcher').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.locator('.ornamental-chain').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('link', { name: new RegExp(spanish['workspace.compareTitle']) }).click();
  await expect(page.getByRole('heading', { level: 1, name: spanish['alignment.title'] })).toBeVisible();
});
