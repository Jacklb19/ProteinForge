import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Project, ProjectWrite } from '../src/features/projects/contracts';
import { SESSION_STORAGE_KEY } from '../src/features/auth/config';
import { PROJECT_POINTER_PREFIX } from '../src/features/projects/config';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { assertFits, navigationLink } from './helpers';

const ID = '00000000-0000-4000-8000-000000000010';
const USER = '00000000-0000-4000-8000-000000000001';
const DATE = '2026-10-12T08:00:00.123456+00:00';
const saved: Project = { id: ID, name: 'Insulina', activeSequence: 'ACDEFGHIKLMNPQRSTVWY', status: 'draft', createdAt: DATE, updatedAt: DATE, workspace: { schemaVersion: 1, profileWindow: 19, descriptors: null, alignment: { first: 'ACD', second: 'ACE', matrix: 'BLOSUM80', mode: 'local', result: null } } };

async function mockProjects(page: Page, initial: Project | null = null) {
  let project = initial; let version = 0; let conflict = false;
  const writes: ProjectWrite[] = [];
  await page.addInitScript(({ storageKey, user }) => {
    localStorage.setItem(storageKey, JSON.stringify({ accessToken: 'e2e-owner-token', refreshToken: 'e2e-refresh-token', expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: user, email: 'test@example.org' } }));
  }, { storageKey: SESSION_STORAGE_KEY, user: USER });
  await page.route('**/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/health')) return route.fulfill({ json: { status: 'ok', version: '0.1.0', identity: true } });
    if (url.pathname.endsWith('/me')) return route.fulfill({ json: { id: USER, email: 'test@example.org' } });
    expect(request.headers().authorization).toBe('Bearer e2e-owner-token');
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

test('owned project saves current calculations, resumes after reload, renames and deletes deliberately', async ({ page }) => {
  const data = await mockProjects(page);
  await page.goto(ROUTES.analyze);
  await page.getByRole('textbox', { name: spanish['editor.label'] }).fill(saved.activeSequence);
  await expect(page.locator('.analysis-ready')).toContainText(spanish['guide.resultsReady']);
  await page.getByRole('textbox', { name: spanish['projects.name'] }).fill('Estudio inicial');
  await page.getByRole('button', { name: spanish['projects.create'], exact: true }).click();
  await expect(page.locator('.project-feedback')).toContainText(spanish['projects.saved']);
  expect(data.writes[0]?.workspace.descriptors?.sequence).toBe(saved.activeSequence);
  expect(data.writes[0]?.workspace.descriptors?.result.length).toBe(saved.activeSequence.length);
  await page.reload();
  await expect(page.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue(saved.activeSequence);
  await expect(page.getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue('Estudio inicial');
  const storage = await page.evaluate((prefix) => Object.entries(localStorage).filter(([key]) => key.startsWith(prefix)), PROJECT_POINTER_PREFIX);
  expect(storage).toEqual([[`${PROJECT_POINTER_PREFIX}${USER}`, ID]]);
  await navigationLink(page, spanish['workspace.nav']).click();
  await page.getByRole('button', { name: 'Renombrar Estudio inicial' }).click();
  await page.getByRole('textbox', { name: spanish['projects.name'] }).fill('Estudio revisado');
  await page.getByRole('button', { name: spanish['projects.confirmRename'] }).click();
  await expect(page.locator('.project-list')).toContainText('Estudio revisado');
  await page.getByRole('button', { name: 'Eliminar Estudio revisado' }).click();
  await expect(page.getByText(spanish['projects.deleteWarning'])).toBeVisible();
  await page.getByRole('button', { name: spanish['projects.cancel'], exact: true }).click();
  expect(data.current()).not.toBeNull();
  await page.getByRole('button', { name: 'Eliminar Estudio revisado' }).click();
  await page.getByRole('button', { name: spanish['projects.confirmDelete'], exact: true }).click();
  await expect(page.locator('.project-feedback')).toContainText(spanish['projects.deleted']);
  await expect(page.getByText(spanish['projects.emptyTitle'])).toBeVisible();
  expect(data.current()).toBeNull();
});

test('a conflict keeps edits, and opening a project restores profile and comparison parameters', async ({ page }) => {
  const data = await mockProjects(page, saved);
  await page.goto(ROUTES.workspace);
  await page.getByRole('button', { name: 'Abrir Insulina' }).click();
  await expect(page.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue(saved.activeSequence);
  await expect(page.getByRole('radio', { name: '19' })).toBeChecked();
  await navigationLink(page, spanish['nav.alignment']).click();
  await expect(page.getByRole('textbox', { name: spanish['alignment.first'] })).toHaveValue('ACD');
  await expect(page.getByRole('radio', { name: 'BLOSUM80' })).toBeChecked();
  await navigationLink(page, spanish['nav.analyze']).click();
  data.setConflict();
  const input = page.getByRole('textbox', { name: spanish['editor.label'] });
  await input.fill('ACDE');
  await page.getByRole('button', { name: spanish['projects.update'], exact: true }).click();
  await expect(page.locator('.project-feedback')).toContainText(spanish['projects.conflict']);
  await expect(input).toHaveValue('ACDE');
  await page.getByRole('button', { name: spanish['projects.saveCopy'], exact: true }).click();
  await expect(page.locator('.project-feedback')).toContainText(spanish['projects.saved']);
  expect(data.writes.at(-1)?.activeSequence).toBe('ACDE');
});

for (const width of [360, 1280]) {
  test(`project list and save controls fit ${String(width)}px with AA and keyboard focus`, async ({ page }) => {
    await mockProjects(page, saved);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.workspace);
    await expect(page.locator('.project-list')).toContainText(saved.name);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).include('.project-library').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/projects-${theme}-${String(width)}.png`, fullPage: true });
    }
    const button = page.getByRole('button', { name: 'Abrir Insulina' });
    await button.focus(); await expect(button).toBeFocused(); await button.press('Enter');
    await expect(page.getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue(saved.name);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).include('.project-toolbar').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/project-editor-${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
