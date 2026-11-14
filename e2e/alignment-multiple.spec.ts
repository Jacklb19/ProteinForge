import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { alignmentVerdict, message } from './helpers';
import { spanish } from '../src/i18n/es';
import { MULTIPLE_MAX_SEQUENCES, MULTIPLE_MIN_SEQUENCES } from '../src/features/alignment/config';
import { ROUTES } from '../src/shared/navigation';

const THREE = '>uno\nACDEFGHIKLMNPQRSTVWY\n>dos\nACDEFGHIKLMNPQRSTVWY\n>tres\nACDEFGHIKLMNPQRSTVWY';

for (const width of [360, 1280]) test(`three sequences are aligned together in their own worker at ${String(width)}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.alignment);
  await expect(alignmentVerdict(page)).toBeVisible();
  const section = page.locator('details.multiple-alignment');
  await section.locator('summary').click();
  const input = section.getByRole('textbox', { name: spanish['multiple.label'] });
  // It starts from the pair already being compared: two records, so one more is needed.
  await expect(input).toHaveValue(/^>.+\n[A-Z]+\n>.+\n[A-Z]+$/);
  const start = section.getByRole('button', { name: spanish['multiple.start'] });
  await start.click();
  await expect(section.getByRole('status')).toHaveText(message('multiple.problemCount', { count: 2, min: MULTIPLE_MIN_SEQUENCES, max: MULTIPLE_MAX_SEQUENCES }));
  await expect(input).toHaveAttribute('aria-invalid', 'true');

  const workers: string[] = [];
  page.on('worker', worker => { workers.push(worker.url()); });
  await input.fill(THREE);
  await start.click();
  const result = section.getByRole('region', { name: spanish['multiple.result'] });
  await expect(result.locator('.verdict')).toHaveText(message('multiple.verdict', { count: 20, total: 20, sequences: 3 }));
  await expect(result.locator('.multiple-names li')).toHaveCount(3);
  await expect(result.locator('.multiple-names li').first()).toContainText('uno');
  await expect(result.getByText(message('multiple.method', { matrix: 'BLOSUM62' }))).toBeVisible();
  expect(workers.some(url => url.includes('multiple.worker'))).toBe(true);
  // Editing after the result marks it as out of date instead of hiding it.
  await input.fill(`${THREE}\n>cuatro\nACDE`);
  await expect(result.getByRole('note')).toHaveText(spanish['alignment.stale']);
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).include('details.multiple-alignment').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
});
