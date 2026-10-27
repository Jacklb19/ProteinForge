import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { identityEnabled, settle, signInWithEmptyAccount } from './helpers';
import { ROUTES } from '../src/shared/navigation';
import { PREFERENCES_STORAGE_KEY } from '../src/preferences/config';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';

const AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const CATALOGS = { es: spanish, en: english } as const;
type Locale = keyof typeof CATALOGS;
const WIDE = 1280;

/** Stores language and theme before the application starts, as a returning visitor would have them. */
async function prefer(page: Page, locale: Locale, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); },
    { key: PREFERENCES_STORAGE_KEY, value: { locale, theme } });
}

/** Axe on the current state, once colour transitions and entrances have finished. */
async function audit(page: Page, state: string): Promise<void> {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(AA).analyze();
  expect(violations.map(violation => `${state}: ${violation.id} → ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Every section of the public page is brought into view, so each one has made its entrance. */
async function revealSections(page: Page): Promise<void> {
  for (const section of await page.locator('#app-content section').all()) await section.scrollIntoViewIfNeeded();
  await page.evaluate(() => { window.scrollTo(0, 0); });
}

/**
 * Walks the keyboard order inside a region and returns, for every stop, whether it has an accessible
 * name and a visible focus indicator that the region does not clip.
 */
async function walk(page: Page, region: Locator, stops: number): Promise<{ name: string; ring: boolean; clipped: boolean }[]> {
  const result = [];
  for (let step = 0; step < stops; step++) {
    await page.keyboard.press('Tab');
    const stop = await region.evaluate(element => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !element.contains(active)) return null;
      const style = getComputedStyle(active);
      const target = active.matches('input') ? active.nextElementSibling ?? active : active;
      const targetStyle = getComputedStyle(target);
      const ring = (targetStyle.outlineStyle !== 'none' && parseFloat(targetStyle.outlineWidth) > 0) || style.boxShadow !== 'none';
      // An ancestor that clips its overflow must leave room for the outline around the control.
      const box = target.getBoundingClientRect();
      const reach = parseFloat(targetStyle.outlineWidth) + Math.max(0, parseFloat(targetStyle.outlineOffset));
      let clipped = false;
      for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const overflow = getComputedStyle(parent);
        if (overflow.overflowX === 'visible' && overflow.overflowY === 'visible') continue;
        const frame = parent.getBoundingClientRect();
        if (box.left - reach < frame.left - 0.5 || box.right + reach > frame.right + 0.5) clipped = true;
      }
      const name = active.getAttribute('aria-label') ?? active.textContent.trim();
      return { name, ring, clipped };
    });
    // Stops before the region (such as the skip link) are passed over; leaving it ends the walk.
    if (!stop) { if (result.length) break; continue; }
    result.push(stop);
  }
  return result;
}

for (const width of [360, WIDE]) {
  for (const locale of ['es', 'en'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`frames, menus, preferences and guide pass AA at ${String(width)}px in ${locale}, ${theme}`, async ({ page }) => {
        const text = CATALOGS[locale];
        await page.setViewportSize({ width, height: 900 });
        await prefer(page, locale, theme);
        await page.goto(ROUTES.home);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await revealSections(page);
        await audit(page, 'public site');
        if (width === WIDE) {
          const preferences = page.locator('.site-bar details.preferences-menu');
          await preferences.locator('summary').click();
          await audit(page, 'public preferences');
          await page.keyboard.press('Escape');
          await expect(preferences).not.toHaveAttribute('open');
        } else {
          await page.getByRole('button', { name: text['shell.openMenu'] }).click();
          await expect(page.getByRole('dialog', { name: text['shell.menu'] })).toBeVisible();
          await audit(page, 'public menu');
          await page.keyboard.press('Escape');
        }

        await page.goto(ROUTES.analyze);
        await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
        if (width === WIDE) {
          const sidebar = page.getByRole('complementary', { name: text['shell.sidebar'] });
          await audit(page, 'sidebar expanded');
          for (const state of ['expanded', 'compact']) {
            const preferences = sidebar.locator('details.preferences-menu');
            await preferences.locator('summary').click();
            await expect(preferences.locator('.preferences-popover')).toBeVisible();
            await audit(page, `sidebar ${state} with preferences`);
            await page.keyboard.press('Escape');
            await expect(preferences).not.toHaveAttribute('open');
            if (state === 'expanded') {
              await sidebar.getByRole('button', { name: text['shell.collapseSidebar'] }).click();
              await expect(page.locator('.workspace')).toHaveAttribute('data-compact', 'true');
              await audit(page, 'sidebar compact');
            }
          }
          await sidebar.getByRole('button', { name: text['shell.expandSidebar'] }).click();
        } else {
          await page.getByRole('button', { name: text['shell.openMenu'] }).click();
          const menu = page.getByRole('dialog', { name: text['shell.menu'] });
          await expect(menu).toBeVisible();
          await audit(page, 'laboratory menu');
          await menu.locator('details.preferences-menu summary').click();
          await audit(page, 'laboratory menu with preferences');
          await page.keyboard.press('Escape');
          await page.keyboard.press('Escape');
          await expect(menu).toBeHidden();
        }

        await page.goto(ROUTES.guide);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await audit(page, 'guide');
      });
    }
  }
}

for (const width of [360, WIDE]) {
  for (const locale of ['es', 'en'] as const) {
    test(`the account menu is named, contained and passes AA at ${String(width)}px in ${locale}, both themes`, async ({ page }) => {
      test.skip(!identityEnabled, 'Needs identity settings on the server under test.');
      const text = CATALOGS[locale];
      await page.setViewportSize({ width, height: 900 });
      await signInWithEmptyAccount(page);
      for (const theme of ['light', 'dark'] as const) {
        await prefer(page, locale, theme);
        await page.goto(ROUTES.analyze);
        await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
        const scope = width === WIDE ? page.getByRole('complementary', { name: text['shell.sidebar'] }) : page.getByRole('dialog', { name: text['shell.menu'] });
        if (width !== WIDE) await page.getByRole('button', { name: text['shell.openMenu'] }).click();
        const trigger = scope.getByRole('button', { name: new RegExp(text['settings.account']) });
        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(scope.getByRole('link', { name: text['workbench.account'] })).toBeVisible();
        await audit(page, `account menu ${theme}`);
        await page.keyboard.press('Escape');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();
      }
    });
  }
}

test('every keyboard stop in the public bar and both sidebar widths is named and shows an unclipped focus ring', async ({ page }) => {
  await page.setViewportSize({ width: WIDE, height: 900 });
  await page.goto(ROUTES.home);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('body').focus();
  const bar = await walk(page, page.locator('.site-bar'), 20);
  expect(bar.length).toBeGreaterThan(3);
  expect(bar.filter(stop => !stop.name || !stop.ring || stop.clipped)).toEqual([]);

  await page.goto(ROUTES.analyze);
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  const sidebar = page.getByRole('complementary', { name: spanish['shell.sidebar'] });
  for (const state of ['expanded', 'compact']) {
    await page.locator('body').focus();
    const stops = await walk(page, sidebar, 40);
    expect(stops.length, state).toBeGreaterThan(5);
    expect(stops.filter(stop => !stop.name || !stop.ring || stop.clipped), state).toEqual([]);
    if (state === 'expanded') await sidebar.getByRole('button', { name: spanish['shell.collapseSidebar'] }).click();
  }
});
