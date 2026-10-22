import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { loadEnv } from 'vite';
import { spanish } from '../src/i18n/es';
import { DEFAULT_LOCALE } from '../src/i18n/config';
import { translate } from '../src/i18n/translate';
import type { TranslationKey, TranslationVariables } from '../src/i18n/translate';
import { readAuthSettings, SESSION_STORAGE_KEY } from '../src/features/auth/config';
import { RESIDUES_PER_BLOCK } from '../src/features/descriptors/config';
import { ListProjectsResponseSchema } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod } from './rpc';

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

/** Catalog text in the default language with its variables resolved. */
export function message(key: TranslationKey, variables?: TranslationVariables): string {
  return translate(DEFAULT_LOCALE, key, variables);
}

/** Catalog text as a pattern in which every variable matches a formatted number. */
export function messagePattern(key: TranslationKey): RegExp {
  const escaped = spanish[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped.replace(/\\\{\\\{\w+\\\}\\\}/g, '[\\d.,]+'));
}

/**
 * Whether the server under test has identity settings. The E2E server is Vite in development mode,
 * so the same environment files decide it; only the presence of the values is read.
 */
export const identityEnabled = readAuthSettings(loadEnv('development', process.cwd(), 'VITE_') as unknown as ImportMetaEnv) !== null;

/** Account used by flows that need a session; requests made with it are always answered by route mocks. */
export const TEST_ACCOUNT = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.org', accessToken: 'e2e-owner-token' } as const;

/** Stores a valid session before the application starts. Identity must be configured on the server under test. */
export async function storeSession(page: Page, account: { id: string; email: string; accessToken: string } = TEST_ACCOUNT): Promise<void> {
  await page.addInitScript(({ key, user }) => {
    localStorage.setItem(key, JSON.stringify({
      accessToken: user.accessToken, refreshToken: 'e2e-refresh-token', expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: { id: user.id, email: user.email },
    }));
  }, { key: SESSION_STORAGE_KEY, user: account });
}

/** Signs in with an account that owns no projects; API and identity requests never leave the machine. */
export async function signInWithEmptyAccount(page: Page): Promise<void> {
  await storeSession(page);
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route(isRpc, (route) => rpcMethod(route) === 'ProjectService/ListProjects'
    ? fulfillRpc(route, ListProjectsResponseSchema, {})
    : fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented'));
}

const themeLabels = { system: spanish['settings.system'], light: spanish['settings.light'], dark: spanish['settings.dark'] } as const;

/** Phone menu, open or not. */
export function siteMenu(page: Page): Locator {
  return page.getByRole('dialog', { name: spanish['shell.menu'] });
}

/** Opens the phone menu through its button and returns the dialog. */
export async function openSiteMenu(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: spanish['shell.openMenu'] }).click();
  await expect(siteMenu(page)).toBeVisible();
  return siteMenu(page);
}

/**
 * Waits until the screen of the current address is on the page. Routes outside the first load arrive as
 * their own chunk, so asking which controls exist before that replaces a real control with a fallback.
 */
export async function routeLoaded(page: Page): Promise<void> {
  // Every screen opens with its own first-level heading; the loading fallback has none.
  await expect(page.locator('#app-content').getByRole('heading', { level: 1 }).first()).toBeVisible();
}

/**
 * Chooses a theme through the control the current page offers: the radios of Perfil, the phone menu of a
 * signed-out visitor, or the bar toggle, which only flips between light and dark.
 */
export async function chooseTheme(page: Page, theme: keyof typeof themeLabels): Promise<void> {
  await routeLoaded(page);
  const radio = page.getByRole('radio', { name: themeLabels[theme], exact: true });
  if (await radio.isVisible()) {
    await radio.check();
  } else if (await page.getByRole('button', { name: spanish['shell.openMenu'] }).isVisible()) {
    const menu = await openSiteMenu(page);
    await menu.getByRole('radio', { name: themeLabels[theme], exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  } else {
    if (theme === 'system') throw new Error('The bar toggle cannot return to the system theme.');
    const toggles = { light: spanish['shell.themeToLight'], dark: spanish['shell.themeToDark'] } as const;
    const target = page.getByRole('button', { name: toggles[theme] });
    // The toggle offers the opposite of what is shown; flipping twice makes an inherited theme explicit.
    if (!await target.isVisible()) await page.getByRole('button', { name: toggles[theme === 'light' ? 'dark' : 'light'] }).click();
    await target.click();
  }
  if (theme === 'system') await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  else await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Title of Alinear while it holds the two bundled insulins; the second name is written mid-sentence. */
export const examplePairTitle = message('alignment.pairTitle', {
  first: spanish['library.insulin'],
  second: spanish['library.bovineInsulin'].charAt(0).toLowerCase() + spanish['library.bovineInsulin'].slice(1),
});

/** Value shown for a term among the alignment figures. */
export function figureValue(page: Page, term: string): Locator {
  return page.locator('dl.figures > div').filter({ has: page.locator('dt').getByText(term, { exact: true }) }).locator('dd');
}

/** Headline of the current alignment result. */
export function alignmentVerdict(page: Page): Locator {
  return page.locator('p.verdict');
}

/** The two alignment inputs; their labels change to the reference name when the text is a bundled reference. */
export function alignmentInputs(page: Page): { first: Locator; second: Locator } {
  return { first: page.locator('#alignment-first'), second: page.locator('#alignment-second') };
}

/** Primary navigation link, distinct from the footer links with the same name. */
export function navigationLink(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link', { name, exact: true });
}

/** Follows a primary destination: from the bar on wide screens, from the menu on phones. */
export async function followNavigation(page: Page, name: string): Promise<void> {
  if (await page.getByRole('button', { name: spanish['shell.openMenu'] }).isVisible()) {
    const menu = await openSiteMenu(page);
    await menu.getByRole('link', { name, exact: true }).click();
    await expect(menu).toBeHidden();
  } else {
    await navigationLink(page, name).click();
  }
}

/** Button that opens the sequence panel of Analizar; its name is shortened on phones. */
export function sequencePanelToggle(page: Page): Locator {
  return page.getByRole('button', { name: new RegExp(`^${spanish['editor.change']}( ${spanish['editor.changeObject']})?$`) });
}

/** Opens the sequence panel of Analizar when it is closed and returns its editor. */
export async function openSequenceEditor(page: Page): Promise<Locator> {
  const toggle = sequencePanelToggle(page);
  await expect(toggle).toHaveAttribute('aria-controls', 'sequence-panel');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const editor = page.getByRole('textbox', { name: spanish['editor.label'], exact: true });
  await expect(editor).toBeVisible();
  return editor;
}

/** Opens the save panel of Analizar or Alinear when it is closed and returns it. */
export async function openProjectPanel(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: spanish['projects.save'], exact: true });
  await expect(toggle).toHaveAttribute('aria-controls', 'project-panel');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return page.locator('#project-panel');
}

/** Opens the export menu when it is closed and returns its popover. */
export async function openExportMenu(page: Page): Promise<Locator> {
  const menu = page.locator('details.toolbar-menu');
  if (!await menu.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await menu.locator('summary', { hasText: spanish['report.export'] }).click();
  }
  return menu.locator('.toolbar-popover');
}

/** Numbered sequence of Analizar. */
export function residueReader(page: Page): Locator {
  return page.getByRole('group', { name: message('profile.readerLabel', { count: RESIDUES_PER_BLOCK }) });
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

/** Opens the per-residue table, which is collapsed by default. */
export async function openValueTable(page: Page): Promise<void> {
  const disclosure = page.locator('details', { has: page.getByText(spanish['profile.tableToggle']) });
  if (!await disclosure.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await disclosure.locator('summary').click();
  }
}
