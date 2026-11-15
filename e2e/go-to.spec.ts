import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { assertFits, setTheme } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

test('on the desktop rail "Go to…" sits under the head, shows its shortcut and hides it when compact', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.projects);
  const rail = page.getByRole('complementary', { name: spanish['shell.sidebar'] });
  const trigger = rail.getByRole('button', { name: spanish['palette.open'] });
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toHaveAttribute('aria-keyshortcuts', /^(Control|Meta)\+K$/);
  await expect(trigger.locator('kbd')).toHaveText(/^(Ctrl|⌘) K$/);
  // Directly after the head and before the tools; the foot no longer repeats it.
  expect(await rail.evaluate(aside => aside.querySelector('.sidebar-head')?.nextElementSibling?.classList.contains('palette-trigger'))).toBe(true);
  await expect(rail.locator('.sidebar-foot').getByRole('button', { name: spanish['palette.open'] })).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await assertFits(page);
    const axe = await new AxeBuilder({ page }).include('.workspace-sidebar').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  }
  await trigger.click();
  await expect(page.getByRole('dialog', { name: spanish['palette.label'] })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  await rail.getByRole('button', { name: spanish['shell.collapseSidebar'] }).click();
  await expect(trigger.locator('kbd')).toBeHidden();
  await trigger.hover();
  await expect(trigger.locator('.sidebar-label')).toBeVisible();
});

test('on a phone the bar opens "Go to…" in one tap, beside the menu and the connection notice', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.projects);
  const bar = page.locator('.workspace-bar');
  const search = bar.getByRole('button', { name: spanish['palette.label'] });
  const menu = bar.getByRole('button', { name: spanish['shell.openMenu'] });
  await expect(search).toBeVisible();
  expect(await search.evaluate(button => button.nextElementSibling?.getAttribute('aria-label'))).toBe(spanish['shell.openMenu']);
  await search.click();
  const palette = page.getByRole('dialog', { name: spanish['palette.label'] });
  await expect(palette.getByRole('combobox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  // The menu keeps its own entry in the foot.
  await menu.click();
  await expect(page.locator('.workspace-sheet .sidebar-foot').getByRole('button', { name: spanish['palette.open'] })).toBeVisible();
  await page.keyboard.press('Escape');

  // Without a connection the bar also carries its short notice; all three fit at 360 px in both themes.
  await context.setOffline(true);
  await expect(bar.locator('.bar-status')).toHaveText(spanish['sync.offline']);
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await assertFits(page);
    const box = await bar.boundingBox();
    for (const control of [search, menu, bar.locator('.bar-status')]) {
      const inside = await control.boundingBox();
      expect(inside && box && inside.x >= box.x && inside.x + inside.width <= box.x + box.width).toBe(true);
    }
    const axe = await new AxeBuilder({ page }).include('.workspace-bar').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  }
  await context.setOffline(false);
});
