import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { spanish } from '../src/i18n/es';

const tokens = readFileSync('src/design-tokens.css', 'utf8');
const manifest = JSON.parse(readFileSync('public/fonts/provenance.json', 'utf8')) as {
  files: { family: string; weight: number; role: 'interface' | 'sequence' }[];
};

/** First declared value of a design token, which holds the light theme value. */
export function token(name: string): string {
  const value = tokens.match(new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`Missing design token ${name}.`);
  return value;
}

export const interfaceFonts = manifest.files.filter((font) => font.role === 'interface');
export const interfaceFamily = interfaceFonts[0]?.family ?? '';

const themeLabels = { system: spanish['settings.system'], light: spanish['settings.light'], dark: spanish['settings.dark'] } as const;

/** Chooses a theme in Settings through its visible radio button. */
export async function chooseTheme(page: Page, theme: keyof typeof themeLabels): Promise<void> {
  await page.getByRole('radio', { name: themeLabels[theme] }).check();
}

/** Definition shown for a term of the alignment summary. */
export function summaryValue(page: Page, term: string): Locator {
  return page.locator('.property', { has: page.locator('dt', { hasText: term }) }).locator('dd');
}

/** Primary navigation link, distinct from the footer links with the same name. */
export function navigationLink(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link', { name, exact: true });
}

/** Waits for every finite animation, so geometry is measured at rest; ambient loops are ignored. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)));
  });
}

/** No horizontal overflow and every visible control keeps a 44 px target. */
export async function assertFits(page: Page): Promise<void> {
  await settle(page);
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    controls: [...document.querySelectorAll('button, select, input[type="file"], a, .segmented-option, summary')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => ({ label: element.textContent.trim() || element.tagName,
        height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width })),
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.controls.filter((control) => control.height < 44 || control.width < 44)).toEqual([]);
}

/** Scrolls through the page so every scroll-revealed section has played its entrance. */
export async function revealAll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight / 2);
    for (let top = 0; top <= document.body.scrollHeight; top += step) {
      window.scrollTo(0, top);
      await new Promise((resolve) => { requestAnimationFrame(() => { resolve(undefined); }); });
    }
    window.scrollTo(0, 0);
  });
  await expect(page.locator('.reveal:not(.is-visible)')).toHaveCount(0);
  await settle(page);
}

/** Opens the per-residue table, which is collapsed by default. */
export async function openValueTable(page: Page): Promise<void> {
  const disclosure = page.locator('details', { has: page.getByText(spanish['profile.tableToggle']) });
  if (!await disclosure.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await disclosure.locator('summary').click();
  }
}
