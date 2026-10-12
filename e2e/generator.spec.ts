import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, navigationLink } from './helpers';
import type { SearchResult } from '../src/features/generator/search';

for (const width of [360, 1280]) {
  test(`candidate search is local, reproducible and usable with AA at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    const outbound: string[] = [];
    page.on('request', (request) => { if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(request.url()).hostname)) outbound.push(request.url()); });
    await page.goto(ROUTES.generate);
    await page.getByLabel(spanish['generator.budget']).fill('100');
    await page.getByLabel(spanish['generator.length']).fill('20');
    await page.getByRole('button', { name: spanish['generator.run'] }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: spanish['generator.done'] })).toBeVisible();
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/generator-${theme}-${String(width)}.png`, fullPage: true });
    }
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: spanish['generator.download'] }).click();
    const download = await downloadPromise; const path = `artifacts/candidates-${String(width)}.json`; await download.saveAs(path);
    const result = JSON.parse(readFileSync(path, 'utf8')) as SearchResult;
    expect(result.parameters.seed).toBe(42); expect(result.guided.evaluations).toBe(100); expect(result.reference.evaluations).toBe(100);
    expect(result.guided.candidates[0]?.sequence.length).toBe(20);
    await page.getByLabel(spanish['generator.seed']).fill('7');
    await expect(page.getByRole('button', { name: spanish['generator.download'] })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: spanish['generator.stale'] })).toBeVisible();
    await page.getByLabel(spanish['generator.seed']).fill('42');
    await page.getByRole('button', { name: spanish['generator.compare'] }).click();
    await expect(page.getByRole('textbox', { name: spanish['alignment.first'] })).toHaveValue(result.guided.candidates[0]?.sequence ?? '');
    await expect(page.getByRole('textbox', { name: spanish['alignment.second'] })).toHaveValue(result.reference.candidates[0]?.sequence ?? '');
    await page.goto(ROUTES.generate);
    await page.getByLabel(spanish['generator.budget']).fill('100');
    await page.getByRole('button', { name: spanish['generator.run'] }).click();
    await expect(page.getByRole('status').filter({ hasText: spanish['generator.done'] })).toBeVisible();
    await page.getByRole('button', { name: spanish['generator.analyze'] }).first().click();
    await expect(page.locator('.analysis-ready')).toBeVisible();
    await navigationLink(page, spanish['workspace.nav']).click();
    await page.getByRole('link', { name: new RegExp(spanish['generator.taskTitle']) }).click();
    await expect(page.getByRole('heading', { name: spanish['generator.results'] })).toBeVisible();
    expect(outbound).toEqual([]);
  });
}
test('cancellation terminates the Worker without presenting partial candidates', async ({ page }) => {
  await page.goto(ROUTES.generate);
  await page.getByLabel(spanish['generator.budget']).fill('5000');
  await page.getByLabel(spanish['generator.length']).fill('300');
  await page.getByRole('button', { name: spanish['generator.run'] }).click();
  await page.getByRole('button', { name: spanish['generator.cancel'] }).click();
  await expect(page.getByRole('status').filter({ hasText: spanish['generator.cancelled'] })).toBeVisible();
  await expect(page.locator('.candidate-list')).toHaveCount(0);
  await expect(page.getByRole('button', { name: spanish['generator.run'] })).toBeEnabled();
});
