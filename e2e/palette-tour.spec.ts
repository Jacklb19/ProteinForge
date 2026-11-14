import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { message } from './helpers';
import { english } from '../src/i18n/en';
import { spanish } from '../src/i18n/es';
import { PREFERENCES_STORAGE_KEY } from '../src/preferences/config';
import { TOUR_STOPS } from '../src/shell/tour';
import { ROUTES } from '../src/shared/navigation';

async function pressPalette(page: Page): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
}

for (const width of [360, 1280]) test(`Ctrl + K reaches a tool by name with the keyboard at ${String(width)}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.analyze);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await pressPalette(page);
  const palette = page.getByRole('dialog', { name: spanish['palette.label'] });
  const search = palette.getByRole('combobox', { name: spanish['palette.label'] });
  await expect(search).toBeFocused();
  await search.fill('zzzz');
  await expect(palette.getByRole('status')).toHaveText(message('palette.empty', { query: 'zzzz' }));
  await search.fill(spanish['nav.alignment'].slice(0, 4));
  const option = palette.getByRole('option', { name: spanish['nav.alignment'] });
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await expect(search).toHaveAttribute('aria-activedescendant', (await option.getAttribute('id')) ?? '');
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await search.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
  // Escape closes it without moving anywhere.
  await pressPalette(page);
  await expect(search).toBeFocused();
  await search.press('Escape');
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
});

for (const width of [360, 1280]) test(`the guided visit opens each tool in order and ends where asked at ${String(width)}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.guide);
  await page.getByRole('button', { name: spanish['tour.start'] }).click();
  for (const [index, stop] of TOUR_STOPS.entries()) {
    const current = page.locator('.tour-panel');
    await expect(page).toHaveURL(new RegExp(`${stop.path}$`));
    await expect(current.getByRole('heading', { level: 2 })).toHaveText(spanish[stop.titleKey]);
    await expect(current.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(current).toContainText(message('tour.progress', { current: index + 1, total: TOUR_STOPS.length }));
    await expect(current).toContainText(spanish[stop.bodyKey]);
    expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    if (index === 1) {
      await current.getByRole('button', { name: spanish['tour.previous'] }).click();
      await expect(page).toHaveURL(new RegExp(`${TOUR_STOPS[0]?.path ?? ''}$`));
      await page.locator('.tour-panel').getByRole('button', { name: spanish['tour.next'] }).click();
      await expect(page).toHaveURL(new RegExp(`${stop.path}$`));
    }
    const last = index === TOUR_STOPS.length - 1;
    await current.getByRole('button', { name: spanish[last ? 'tour.finish' : 'tour.next'] }).click();
  }
  await expect(page.locator('.tour-panel')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${TOUR_STOPS.at(-1)?.path ?? ''}$`));
});

test('the visit can be left at any stop and speaks English when chosen', async ({ page }) => {
  await page.addInitScript(key => { localStorage.setItem(key, JSON.stringify({ locale: 'en', theme: 'light' })); }, PREFERENCES_STORAGE_KEY);
  await page.goto(ROUTES.guide);
  await page.getByRole('button', { name: english['tour.start'] }).click();
  const current = page.locator('.tour-panel');
  await expect(current.getByRole('heading', { level: 2 })).toHaveText(english[TOUR_STOPS[0]?.titleKey ?? 'nav.analyze']);
  await current.getByRole('button', { name: english['tour.end'] }).click();
  await expect(current).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${TOUR_STOPS[0]?.path ?? ''}$`));
});
