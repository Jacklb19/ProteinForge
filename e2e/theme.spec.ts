import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chooseTheme, message, openSequenceEditor, openValueTable, residueReader, signInWithEmptyAccount, setTheme } from './helpers';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { RESIDUE_NAMES } from '../src/features/chemistry/config';

test('light and dark themes pass WCAG AA axe checks', async ({ page }) => {
  await page.goto(ROUTES.analyze);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => { await navigator.clipboard.writeText('ACDEFGHIKLMNPQRSTVWY'); });
  const input = await openSequenceEditor(page);
  await input.focus();
  // Pasting over the selected example replaces it.
  await input.press('ControlOrMeta+A');
  await input.press('ControlOrMeta+V');
  await expect(input).toHaveValue('ACDEFGHIKLMNPQRSTVWY');
  await expect(page.getByText(spanish['editor.noInvalid'])).toBeVisible();
  await expect(page.getByText(spanish['descriptors.mass'], { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: spanish['workbench.profile'], exact: true }).click();
  await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();
  await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
  await residueReader(page).locator('[data-position="10"]').click();
  await expect(page.locator('#reader-readout')).toContainText(message('profile.readerName', { name: RESIDUE_NAMES.L, position: 10 }));
  await expect(page.locator('#reader-readout')).toContainText(message('profile.readerHydropathy', { start: 6, end: 14, value: '' }).trim());
  await page.getByRole('tab', { name: spanish['workbench.profile'], exact: true }).click();
  await expect(page.locator('.chart-cursor')).toBeAttached();
  await expect(page.locator('.chart-window')).toBeAttached();
  await openValueTable(page);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('tr[aria-selected="true"] th')).toHaveText('10');

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

test('the profile persists language and theme after reload', async ({ page }) => {
  await signInWithEmptyAccount(page);
  await page.goto(ROUTES.profile);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['account.title']);
  for (const theme of ['light', 'dark'] as const) {
    await chooseTheme(page, theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
  await page.getByRole('radio', { name: spanish['settings.english'], exact: true }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: new RegExp(spanish['settings.english']) })).toBeChecked();
});

test('a signed-out visitor keeps the theme chosen from the bar after reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(ROUTES.analyze);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await chooseTheme(page, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('details.preferences-menu summary')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await chooseTheme(page, 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('details.preferences-menu summary')).toBeVisible();
});
