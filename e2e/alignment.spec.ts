import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('aligns with progress, supports cancellation, and displays reproducible metrics', async ({ page }) => {
  await page.goto('/alignment');
  await page.getByRole('textbox', { name: 'Primera secuencia' }).fill('A'.repeat(3000));
  await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill('A'.repeat(3000));
  await page.getByRole('button', { name: 'Alinear' }).click();
  await expect(page.getByRole('status')).toContainText('Alineando');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('status')).toContainText('cancelado');
  await expect(page.getByRole('heading', { name: 'Resultado del alineamiento' })).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Primera secuencia' }).fill('ACDEFGHIKLMNPQRSTVWY');
  await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill('ACDEFGHIKLMNPQRSTVWY');
  await page.getByRole('button', { name: 'Alinear' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado del alineamiento' })).toBeVisible();
  await expect(page.getByText(/Identidad: 20 de 20 columnas/)).toBeVisible();
  await expect(page.getByText(/Similitud: 20 de 20 columnas/)).toBeVisible();
  await expect(page.getByText(/BLOSUM62, modo Global, apertura 10, extensión 0,5, extremos gratuitos/)).toBeVisible();
  await expect(page.getByText('Columnas 1 a 20')).toBeVisible();
});

test('alignment remains accessible at mobile and desktop widths', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      await page.goto('/settings');
      await page.getByRole('combobox', { name: 'Tema' }).selectOption(theme);
      await page.goto('/alignment');
      await page.getByRole('textbox', { name: 'Primera secuencia' }).fill('ACDEFGHIKLMNPQRSTVWY');
      await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill('ACDEFGHIKLMNPQRSTVWY');
      await page.getByRole('button', { name: 'Alinear' }).click();
      await expect(page.getByRole('heading', { name: 'Resultado del alineamiento' })).toBeVisible();
      const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    }
  }
});
