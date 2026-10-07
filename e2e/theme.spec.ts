import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chooseTheme, openValueTable } from './helpers';

test('light and dark themes pass WCAG AA axe checks', async ({ page }) => {
  await page.goto('/');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => { await navigator.clipboard.writeText('ACDEFGHIKLMNPQRSTVWY'); });
  const input = page.getByRole('textbox', { name: /secuencia de aminoácidos/i });
  await input.focus();
  await input.press('ControlOrMeta+V');
  await expect(input).toHaveValue('ACDEFGHIKLMNPQRSTVWY');
  await expect(page.getByText('No hay posiciones inválidas.')).toBeVisible();
  await expect(page.getByText('Masa molecular')).toBeVisible();
  await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();
  await page.getByRole('group', { name: /Secuencia numerada/ }).locator('[data-position="10"]').click();
  await expect(page.getByText(/Residuo 10: L/)).toBeVisible();
  await openValueTable(page);
  await expect(page.getByRole('table')).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

test('settings persist language and theme after reload', async ({ page }) => {
  await page.goto('/settings');
  for (const theme of ['light', 'dark'] as const) {
    await chooseTheme(page, theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
  await page.getByRole('radio', { name: 'English' }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: /English/ })).toBeChecked();
});
