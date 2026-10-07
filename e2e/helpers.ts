import { readFileSync } from 'node:fs';
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

/** Opens the per-residue table, which is collapsed by default. */
export async function openValueTable(page: Page): Promise<void> {
  const disclosure = page.locator('details', { has: page.getByText(spanish['profile.tableToggle']) });
  if (!await disclosure.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await disclosure.locator('summary').click();
  }
}
