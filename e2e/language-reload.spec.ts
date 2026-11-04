import { expect, test } from './test';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import { ROUTES } from '../src/shared/navigation';
import { languageButton } from './helpers';

// English arrives as its own chunk. On a slow connection a visitor can reload before it does; the choice
// must already be stored, as continuous integration showed when it was saved only after the download.
const ENGLISH_CATALOG = /\/i18n\/en(\.ts|-[\w-]+\.js)|\/en-[\w-]+\.js/;
const SLOW_CATALOG_MS = 3000;

test('choosing English and reloading before its catalog arrives keeps English', async ({ page }) => {
  let held = 0;
  await page.route(ENGLISH_CATALOG, async (route) => {
    held += 1;
    await new Promise((resolve) => setTimeout(resolve, SLOW_CATALOG_MS));
    await route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  // Language is chosen in the public bar (on the profile once inside the laboratory).
  await page.goto(ROUTES.home);
  const englishButton = languageButton(page, spanish['settings.english']);
  await englishButton.click();
  await expect(englishButton).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: SLOW_CATALOG_MS * 5 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(english['public.heroTitle']);
  expect(held).toBeGreaterThan(0);
});
