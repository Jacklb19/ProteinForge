import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('light and dark themes pass WCAG AA axe checks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: /secuencia de aminoácidos/i }).fill('ACDEFGHIKLMNPQRSTVWY');
  await expect(page.getByRole('table')).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});
