import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, followNavigation, message, openSequenceEditor } from './helpers';
import { INITIAL_SEARCH_FORM } from '../src/features/generator/context';
import type { SearchResult } from '../src/features/generator/search';

const initial = { budget: Number(INITIAL_SEARCH_FORM.budget), length: Number(INITIAL_SEARCH_FORM.length), seed: Number(INITIAL_SEARCH_FORM.seed) };

for (const width of [360, 1280]) {
  test(`candidate search is local, reproducible and usable with AA at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    const outbound: string[] = [];
    page.on('request', (request) => { if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(request.url()).hostname)) outbound.push(request.url()); });
    const done = page.getByRole('status').filter({ hasText: spanish['generator.done'] });
    const stale = page.getByRole('status').filter({ hasText: spanish['generator.stale'] });
    const results = page.getByRole('heading', { name: spanish['generator.results'] });
    const details = (budget: number, length: number) => page.getByText(message('generator.runDetails', { seed: initial.seed, budget, length }));
    await page.goto(ROUTES.generate);
    await page.locator('.generator-advanced summary').click();
    // The page runs the search with its initial form on arrival; results appear without pressing anything.
    await expect(done).toBeVisible();
    await expect(results).toBeVisible();
    await expect(details(initial.budget, initial.length)).toBeVisible();
    await expect(page.locator('.candidate-list')).toHaveCount(2);
    await page.getByLabel(spanish['generator.budget']).fill('100');
    await page.getByLabel(spanish['generator.length']).fill('20');
    await expect(stale).toBeVisible();
    await page.getByRole('button', { name: spanish['generator.run'] }).focus(); await page.keyboard.press('Enter');
    await expect(details(100, 20)).toBeVisible();
    await expect(done).toBeVisible();
    await expect(stale).toHaveCount(0);
    // Candidates are drawn as residue cells; the plain sequence stays available to assistive technology.
    const candidate = page.locator('.candidate-list li').first();
    await expect(candidate.locator('.candidate-cells')).toHaveAttribute('aria-hidden', 'true');
    await expect(candidate.locator('.candidate-cells .residue')).toHaveCount(20);
    await expect(candidate.locator('code.visually-hidden')).toHaveText(/^[ACDEFGHIKLMNPQRSTVWY]{20}$/);
    const method = page.locator('details', { has: page.locator('summary', { hasText: spanish['generator.methodTitle'] }) });
    await expect(method.getByText(spanish['generator.methodText'])).toBeHidden();
    await method.locator('summary').click();
    await expect(method.getByText(spanish['generator.methodText'])).toBeVisible();
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
    await expect(candidate.locator('code.visually-hidden')).toHaveText(result.guided.candidates[0]?.sequence ?? '');
    await page.getByLabel(spanish['generator.seed']).fill('7');
    await expect(page.getByRole('button', { name: spanish['generator.download'] })).toBeDisabled();
    await expect(stale).toBeVisible();
    await page.getByLabel(spanish['generator.seed']).fill('42');
    // The comparison draft holds the bundled example, so replacing it is confirmed first.
    await page.getByRole('button', { name: spanish['generator.compare'] }).click();
    await expect(page.getByRole('group', { name: spanish['generator.replace'] })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.generate}$`));
    await page.getByRole('button', { name: spanish['generator.confirm'] }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
    await expect(page.getByRole('textbox', { name: spanish['alignment.first'] })).toHaveValue(result.guided.candidates[0]?.sequence ?? '');
    await expect(page.getByRole('textbox', { name: spanish['alignment.second'] })).toHaveValue(result.reference.candidates[0]?.sequence ?? '');
    await page.goto(ROUTES.generate);
    await page.locator('.generator-advanced summary').click();
    await expect(done).toBeVisible();
    await page.getByLabel(spanish['generator.budget']).fill('100');
    await page.getByRole('button', { name: spanish['generator.run'] }).click();
    await expect(details(100, initial.length)).toBeVisible();
    await expect(stale).toHaveCount(0);
    const chosen = await page.locator('.candidate-list li').first().locator('code.visually-hidden').innerText();
    await page.getByRole('button', { name: spanish['generator.analyze'] }).first().click();
    await page.getByRole('button', { name: spanish['generator.confirm'] }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
    await expect(page.getByRole('heading', { level: 2, name: spanish['editor.ownTitle'], exact: true })).toBeVisible();
    await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
    await expect(await openSequenceEditor(page)).toHaveValue(chosen);
    await followNavigation(page, spanish['nav.generate']);
    await expect(results).toBeVisible();
    await expect(details(100, initial.length)).toBeVisible();
    expect(outbound).toEqual([]);
  });
}
test('cancellation terminates the Worker without presenting partial candidates', async ({ page }) => {
  await page.goto(ROUTES.generate);
    await page.locator('.generator-advanced summary').click();
  const run = page.getByRole('button', { name: spanish['generator.run'] });
  await expect(page.getByRole('status').filter({ hasText: spanish['generator.done'] })).toBeVisible();
  await expect(page.getByText(message('generator.runDetails', initial))).toBeVisible();
  await page.getByLabel(spanish['generator.budget']).fill('5000');
  await page.getByLabel(spanish['generator.length']).fill('300');
  await run.click();
  await page.getByRole('button', { name: spanish['generator.cancel'] }).click();
  await expect(page.getByRole('status').filter({ hasText: spanish['generator.cancelled'] })).toBeVisible();
  // Only the complete search made on arrival remains, marked as belonging to other conditions.
  await expect(page.getByText(message('generator.runDetails', initial))).toBeVisible();
  await expect(page.locator('.candidate-list')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: spanish['generator.stale'] })).toBeVisible();
  await expect(page.getByRole('button', { name: spanish['generator.analyze'] }).first()).toBeDisabled();
  await expect(run).toBeEnabled();
});
