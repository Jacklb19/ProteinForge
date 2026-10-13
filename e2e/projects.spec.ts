import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Project, ProjectWrite } from '../src/features/projects/contracts';
import { PROJECT_POINTER_PREFIX } from '../src/features/projects/config';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { alignmentInputs, assertFits, message, navigationLink, openProjectPanel, openSequenceEditor, storeSession, TEST_ACCOUNT } from './helpers';

const ID = '00000000-0000-4000-8000-000000000010';
const USER = TEST_ACCOUNT.id;
const DATE = '2026-10-12T08:00:00.123456+00:00';
const saved: Project = { id: ID, name: 'Insulina', activeSequence: 'ACDEFGHIKLMNPQRSTVWY', status: 'draft', createdAt: DATE, updatedAt: DATE, workspace: { schemaVersion: 1, profileWindow: 19, descriptors: null, alignment: { first: 'ACD', second: 'ACE', matrix: 'BLOSUM80', mode: 'local', result: null } } };

async function mockProjects(page: Page, initial: Project | null = null) {
  let project = initial; let version = 0; let conflict = false;
  const writes: ProjectWrite[] = [];
  await storeSession(page);
  await page.route('**/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/health')) return route.fulfill({ json: { status: 'ok', version: '0.1.0', identity: true } });
    if (url.pathname.endsWith('/me')) return route.fulfill({ json: { id: USER, email: TEST_ACCOUNT.email } });
    expect(request.headers().authorization).toBe(`Bearer ${TEST_ACCOUNT.accessToken}`);
    if (request.method() === 'GET' && url.pathname.endsWith('/projects')) return route.fulfill({ json: { items: project ? [{ id: project.id, name: project.name, status: project.status, createdAt: project.createdAt, updatedAt: project.updatedAt }] : [], nextOffset: null } });
    if (request.method() === 'GET') return route.fulfill({ status: project ? 200 : 404, json: project ?? { status: 404 } });
    if (request.method() === 'DELETE') { project = null; return route.fulfill({ status: 204 }); }
    if (conflict && request.method() === 'PUT') return route.fulfill({ status: 409, json: { type: 'https://proteinforge.invalid/problems/project-conflict', requestId: 'e2e-conflict' } });
    const payload = request.postDataJSON() as ProjectWrite & { expectedUpdatedAt?: string };
    if (request.method() === 'PUT') expect(payload.expectedUpdatedAt).toBe(project?.updatedAt);
    const { name, activeSequence, workspace } = payload;
    writes.push({ name, activeSequence, workspace });
    project = { ...saved, name, activeSequence, workspace, updatedAt: `2026-10-12T08:00:${String(++version).padStart(2, '0')}.123456+00:00` };
    return route.fulfill({ status: request.method() === 'POST' ? 201 : 200, json: project });
  });
  return { writes, setConflict: () => { conflict = true; }, current: () => project };
}

/** Project list of Perfil. */
function projectLibrary(page: Page): Locator {
  return page.getByRole('region', { name: spanish['projects.title'] });
}

test('owned project saves current calculations and resumes after reload', async ({ page }) => {
  const data = await mockProjects(page);
  await page.goto(ROUTES.analyze);
  const editor = await openSequenceEditor(page);
  await editor.fill(saved.activeSequence);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['editor.ownTitle']);
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  await expect(page.locator('.descriptor-panel .status-message')).toHaveAttribute('data-state', 'current');
  const panel = await openProjectPanel(page);
  await panel.getByRole('textbox', { name: spanish['projects.name'] }).fill('Estudio inicial');
  await panel.getByRole('button', { name: spanish['projects.create'], exact: true }).click();
  await expect(panel.locator('.project-feedback')).toContainText(spanish['projects.saved']);
  expect(data.writes[0]?.activeSequence).toBe(saved.activeSequence);
  expect(data.writes[0]?.workspace.descriptors?.sequence).toBe(saved.activeSequence);
  expect(data.writes[0]?.workspace.descriptors?.result.length).toBe(saved.activeSequence.length);
  const storage = await page.evaluate((prefix) => Object.entries(localStorage).filter(([key]) => key.startsWith(prefix)), PROJECT_POINTER_PREFIX);
  expect(storage).toEqual([[`${PROJECT_POINTER_PREFIX}${USER}`, ID]]);
  await page.reload();
  await expect(await openSequenceEditor(page)).toHaveValue(saved.activeSequence);
  await expect((await openProjectPanel(page)).getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue('Estudio inicial');
});

test('the profile lists owned projects, renames and deletes them deliberately', async ({ page }) => {
  const data = await mockProjects(page, { ...saved, name: 'Estudio inicial' });
  await page.goto(ROUTES.analyze);
  await page.getByRole('link', { name: message('shell.account', { email: TEST_ACCOUNT.email }) }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
  const library = projectLibrary(page);
  await expect(library.getByRole('heading', { level: 2, name: spanish['projects.title'] })).toBeVisible();
  await expect(library.locator('.project-list')).toContainText('Estudio inicial');
  await library.getByRole('button', { name: message('projects.renameNamed', { name: 'Estudio inicial' }) }).click();
  await library.getByRole('textbox', { name: spanish['projects.name'] }).fill('Estudio revisado');
  await library.getByRole('button', { name: spanish['projects.confirmRename'] }).click();
  await expect(library.locator('.project-list')).toContainText('Estudio revisado');
  expect(data.writes.at(-1)?.name).toBe('Estudio revisado');
  expect(data.writes.at(-1)?.activeSequence).toBe(saved.activeSequence);
  await library.getByRole('button', { name: spanish['projects.refresh'], exact: true }).click();
  await expect(library.locator('.project-list')).toContainText('Estudio revisado');
  await library.getByRole('button', { name: message('projects.deleteNamed', { name: 'Estudio revisado' }) }).click();
  await expect(page.getByText(spanish['projects.deleteWarning'])).toBeVisible();
  await library.getByRole('button', { name: spanish['projects.cancel'], exact: true }).click();
  expect(data.current()).not.toBeNull();
  await library.getByRole('button', { name: message('projects.deleteNamed', { name: 'Estudio revisado' }) }).click();
  await library.getByRole('button', { name: spanish['projects.confirmDelete'], exact: true }).click();
  await expect(library.locator('.project-feedback')).toContainText(spanish['projects.deleted']);
  await expect(page.getByText(spanish['projects.emptyTitle'])).toBeVisible();
  expect(data.current()).toBeNull();
});

test('a conflict keeps edits, and opening a project restores profile and comparison parameters', async ({ page }) => {
  const data = await mockProjects(page, saved);
  await page.goto(ROUTES.profile);
  await projectLibrary(page).getByRole('button', { name: message('projects.openNamed', { name: saved.name }) }).click();
  // The visit already holds the bundled example, so replacing it is confirmed first.
  await expect(page.getByText(spanish['projects.replaceWarning'])).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
  await page.getByRole('button', { name: spanish['projects.confirmOpen'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(await openSequenceEditor(page)).toHaveValue(saved.activeSequence);
  await expect(page.getByRole('radio', { name: '19', exact: true })).toBeChecked();
  await navigationLink(page, spanish['nav.alignment']).click();
  await expect(page.getByRole('textbox', { name: spanish['alignment.first'], exact: true })).toHaveValue('ACD');
  await expect(alignmentInputs(page).second).toHaveValue('ACE');
  await expect(page.getByRole('radio', { name: 'BLOSUM80' })).toBeChecked();
  await expect(page.getByRole('radio', { name: spanish['alignment.local'], exact: true })).toBeChecked();
  await navigationLink(page, spanish['nav.analyze']).click();
  data.setConflict();
  const input = await openSequenceEditor(page);
  await input.fill('ACDE');
  // The save panel and the sequence panel share one place; the edit survives switching between them.
  let panel = await openProjectPanel(page);
  await expect(panel.getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue(saved.name);
  await panel.getByRole('button', { name: spanish['projects.update'], exact: true }).click();
  await expect(panel.locator('.project-feedback')).toContainText(spanish['projects.conflict']);
  await expect(await openSequenceEditor(page)).toHaveValue('ACDE');
  panel = await openProjectPanel(page);
  await panel.getByRole('button', { name: spanish['projects.saveCopy'], exact: true }).click();
  await expect(panel.locator('.project-feedback')).toContainText(spanish['projects.saved']);
  expect(data.writes.at(-1)?.activeSequence).toBe('ACDE');
});

for (const width of [360, 1280]) {
  test(`project list and save controls fit ${String(width)}px with AA and keyboard focus`, async ({ page }) => {
    await mockProjects(page, saved);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.profile);
    await expect(page.locator('.project-list')).toContainText(saved.name);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).include('.project-library').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/projects-${theme}-${String(width)}.png`, fullPage: true });
    }
    const button = page.getByRole('button', { name: message('projects.openNamed', { name: saved.name }) });
    await button.focus(); await expect(button).toBeFocused(); await button.press('Enter');
    // Opening replaces the example of this visit, so it asks first; the confirmation is checked like the list.
    const confirm = page.getByRole('button', { name: spanish['projects.confirmOpen'], exact: true });
    await expect(confirm).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).include('.project-library').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    }
    await confirm.focus(); await expect(confirm).toBeFocused(); await confirm.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
    const panel = await openProjectPanel(page);
    await expect(panel.getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue(saved.name);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).include('#project-panel').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/project-editor-${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
