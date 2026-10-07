import { expect, test } from '@playwright/test';

test('loads WASM and completes a parallel alignment of 2000 residues', async ({ page }) => {
  const wasmResponses: number[] = [];
  page.on('response', (response) => {
    if (response.url().includes('.wasm')) wasmResponses.push(response.status());
  });
  await page.goto('/alignment');
  const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(100);
  await page.getByRole('textbox', { name: 'Primera secuencia' }).fill(sequence);
  await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill(sequence);
  const start = Date.now();
  await page.getByRole('button', { name: 'Alinear' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado del alineamiento' })).toBeVisible();
  const elapsedMs = Date.now() - start;
  await expect(page.getByText(/Identidad: 2\.000 de 2\.000 columnas/)).toBeVisible();
  expect(wasmResponses.length).toBeGreaterThan(0);
  expect(wasmResponses.every((status) => status === 200)).toBe(true);
  await test.info().attach('alignment-timing', { body: JSON.stringify({ elapsedMs }), contentType: 'application/json' });
  console.info(`Parallel WASM alignment, 2000 residues: ${String(elapsedMs)} ms (local browser).`);
});

test('reports a WASM download failure without presenting a result', async ({ page }) => {
  await page.route(/\.wasm(?:\?|$)/, (route) => route.abort());
  await page.goto('/alignment');
  await page.getByRole('textbox', { name: 'Primera secuencia' }).fill('ACDEFGHIK');
  await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill('ACDEFGHIK');
  await page.getByRole('button', { name: 'Alinear' }).click();
  await expect(page.getByRole('button', { name: 'Alinear' })).toBeEnabled();
  await expect(page.getByRole('status')).not.toContainText('Alineando');
  await expect(page.getByRole('status')).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Resultado del alineamiento' })).toHaveCount(0);
});
