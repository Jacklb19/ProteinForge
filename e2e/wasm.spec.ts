import { expect, test } from '@playwright/test';
import { alignmentInputs, alignmentVerdict, figureValue, message } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

const running = message('alignment.running', { percent: '' });

test('loads WASM and completes a parallel alignment of 2000 residues', async ({ page }) => {
  const wasmResponses: number[] = [];
  page.on('response', (response) => {
    if (response.url().includes('.wasm')) wasmResponses.push(response.status());
  });
  await page.goto(ROUTES.alignment);
  // The bundled example is aligned on arrival; wait for it so the timing covers only the long alignment.
  await expect(alignmentVerdict(page)).toBeVisible();
  const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(100);
  const { first, second } = alignmentInputs(page);
  await first.fill(sequence);
  await second.fill(sequence);
  const start = Date.now();
  await page.getByRole('button', { name: spanish['alignment.start'], exact: true }).click();
  await expect(alignmentVerdict(page)).toHaveText(message('alignment.verdict', { count: '2.000', total: '2.000' }));
  const elapsedMs = Date.now() - start;
  await expect(page.getByRole('heading', { name: spanish['alignment.result'] })).toBeAttached();
  await expect(figureValue(page, spanish['alignment.identity'])).toHaveText(/^100\s?%$/);
  expect(wasmResponses.length).toBeGreaterThan(0);
  expect(wasmResponses.every((status) => status === 200)).toBe(true);
  await test.info().attach('alignment-timing', { body: JSON.stringify({ elapsedMs }), contentType: 'application/json' });
  console.info(`Parallel WASM alignment, 2000 residues: ${String(elapsedMs)} ms (local browser).`);
});

test('reports a WASM download failure without presenting a result', async ({ page }) => {
  await page.route(/\.wasm(?:\?|$)/, (route) => route.abort());
  await page.goto(ROUTES.alignment);
  const start = page.getByRole('button', { name: spanish['alignment.start'], exact: true });
  const status = page.locator('.alignment-inputs').getByRole('status');
  const result = page.getByRole('heading', { name: spanish['alignment.result'] });
  // The automatic alignment of the bundled example fails first, and says so.
  await expect(status).toContainText(spanish['alignment.workerError']);
  await expect(result).toHaveCount(0);
  const { first, second } = alignmentInputs(page);
  await first.fill('ACDEFGHIK');
  await second.fill('ACDEFGHIK');
  await start.click();
  await expect(start).toBeEnabled();
  await expect(status).not.toContainText(running);
  await expect(status).not.toBeEmpty();
  await expect(result).toHaveCount(0);
  await expect(alignmentVerdict(page)).toHaveCount(0);
});
