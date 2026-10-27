import { expect, test } from '@playwright/test';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { openValueTable } from './helpers';

test('cached Workers keep their isolation policy across reloads and internal navigation', async ({ page }) => {
  const failures: string[] = [];
  const policies: (string | undefined)[] = [];
  page.on('response', response => {
    if (/\.worker[-.]/.test(response.url())) policies.push(response.headers()['cross-origin-resource-policy']);
  });
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  for (let visit = 0; visit < 2; visit++) {
    await page.goto(ROUTES.home);
    await expect(page.locator('.stage-hero canvas')).toBeVisible();
    await page.locator(`.hero-actions a[href="${ROUTES.analyze}"]`).click();
    await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
    await page.goto(ROUTES.alignment);
    await expect(page.locator('.verdict')).toBeVisible();
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  }
  expect(failures).toEqual([]);
  expect(policies.length).toBeGreaterThan(0);
  expect(policies.every(policy => policy === 'same-origin')).toBe(true);
});

test('the profile either draws in its Worker or exposes the calculated table without canvas transfer', async ({ page, browserName }) => {
  await page.goto(ROUTES.analyze);
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  await page.getByRole('tab', { name: spanish['workbench.profile'], exact: true }).click();
  const canTransfer = await page.evaluate(() => typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function');
  if (canTransfer) {
    await expect(page.locator('canvas.hydropathy-chart')).toBeVisible();
  } else {
    await expect(page.locator('#profile-status')).toHaveText(spanish['profile.unavailable']);
    await expect(page.locator('canvas.hydropathy-chart')).toBeHidden();
  }
  // This is a required data path for every engine, including those without OffscreenCanvas transfer.
  await openValueTable(page);
  const table = page.locator('.profile-table-container table');
  await expect(table.locator('tbody tr').first()).toContainText('M');
  await expect(table.locator('tbody tr').nth(4).locator('td').nth(1)).toHaveText(/^-?\d+,\d+$/);
  await page.locator('input[value="19"]').check();
  await expect(table.locator('caption')).toContainText('19');
  await expect(table.locator('tbody tr').nth(9).locator('td').nth(1)).toHaveText(/^-?\d+,\d+$/);
  await page.screenshot({ path: `artifacts/quality/profile-data-${browserName}-2026-10-25.png`, fullPage: true });
});
