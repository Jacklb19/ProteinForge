import { expect, test } from '@playwright/test';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, chooseTheme, languageButton, openSequenceEditor, residueReader } from './helpers';

for (const width of [360, 1280]) test(`related analysis views retain selection, window and draft at ${String(width)}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.analyze);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['workbench.analyzeTitle']);
  await expect(page.getByRole('tab', { name: spanish['workbench.summary'], exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.descriptor-panel')).toBeVisible();
  await expect.poll(() => page.workers().filter(worker => worker.url().includes('profile.worker')).length).toBe(1);
  const workers = page.workers().filter(worker => worker.url().includes('profile.worker'));
  const sequence = page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true });
  await sequence.click();
  await residueReader(page).locator('[data-position="42"]').click();
  await sequence.focus(); await page.keyboard.press('ArrowRight');
  const profile = page.getByRole('tab', { name: spanish['workbench.profile'], exact: true });
  await expect(profile).toBeFocused();
  await page.getByRole('radio', { name: '19', exact: true }).check();
  const canvas = page.locator('canvas.hydropathy-chart');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width)).toBeGreaterThan(100);
  await sequence.click();
  await expect(residueReader(page).locator('[data-position="42"]')).toHaveClass(/is-selected/);
  await profile.click(); await expect(page.getByRole('radio', { name: '19', exact: true })).toBeChecked();
  expect(page.workers().filter(worker => worker.url().includes('profile.worker'))).toEqual(workers);
  const input = await openSequenceEditor(page); await input.fill('ACDEFGHIKLMNPQRSTVWY');
  await page.getByRole('tab', { name: spanish['workbench.summary'], exact: true }).click();
  await expect(page.locator('.subject-summary h2')).toHaveText(spanish['editor.ownTitle']);
  await page.getByRole('tab', { name: spanish['workbench.structure'], exact: true }).click();
  await expect(page.getByText(spanish['workbench.noStructure'], { exact: false })).toBeVisible();
  await expect(input).toHaveValue('ACDEFGHIKLMNPQRSTVWY');
  for (const theme of ['light', 'dark'] as const) { await chooseTheme(page, theme); await assertFits(page); }
});

test('desktop language works without an account and keeps its choice across navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(ROUTES.analyze);
  const englishButton = languageButton(page.locator('.workspace-sidebar'), spanish['settings.english']);
  await englishButton.click();
  await expect(englishButton).toBeFocused();
  await expect(englishButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(english['workbench.analyzeTitle']);
  await page.locator('.workspace-sidebar').getByRole('link', { name: english['nav.library'], exact: true }).click();
  await expect(page.getByRole('tab', { name: english['library.catalogTitle'] })).toHaveAttribute('aria-selected', 'true');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
