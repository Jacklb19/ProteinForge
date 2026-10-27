import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { calculateDescriptors } from '../src/features/descriptors/descriptors';
import { alignSequences } from '../src/features/alignment/gotoh';
import type { Project, WorkspaceSnapshot } from '../src/features/projects/contracts';
import { workspaceDocument, workspaceMessage } from '../src/features/projects/rpcMapping';
import { PROJECT_POINTER_PREFIX, PROJECT_PREVIEW_RESIDUES } from '../src/features/projects/config';
import { timestampFromIso, isoFromTimestamp } from '../src/features/api/timestamps';
import { AlignmentMode, SourceOrigin, SubstitutionMatrix } from '../src/gen/proteinforge/project/v1/workspace_pb';
import { CreateProjectRequestSchema, CreateProjectResponseSchema, DeleteProjectRequestSchema, DeleteProjectResponseSchema, GetProjectRequestSchema, GetProjectResponseSchema, ListProjectsRequestSchema, ListProjectsResponseSchema, ProjectOrder, ProjectStatus, UpdateProjectRequestSchema, UpdateProjectResponseSchema } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { GetMeResponseSchema, GetStatusResponseSchema } from '../src/gen/proteinforge/account/v1/account_service_pb';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import { PREFERENCES_STORAGE_KEY } from '../src/preferences/config';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, followNavigation, message, openProjectPanel, openSequenceEditor, storeSession, TEST_ACCOUNT } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

const DATE = '2026-10-19T10:00:00.123456Z';
const HUMAN = '00000000-0000-4000-8000-000000000010';
const COMPARISON = '00000000-0000-4000-8000-000000000011';
const LYSOZYME = '00000000-0000-4000-8000-000000000012';
const MIXED = '00000000-0000-4000-8000-000000000013';
const prefix = (sequence: string): string => sequence.slice(0, PROJECT_PREVIEW_RESIDUES);
function sequence(accession: string): string { return readFileSync(`src/features/descriptors/fixtures/${accession}.fasta`, 'utf8').split(/\r?\n/).filter(line => !line.startsWith('>')).join('').trim(); }
function analysis(id: string, name: string, accession: string): Project {
  const text = sequence(accession);
  return { id, name, status: 'draft', createdAt: DATE, updatedAt: DATE, activeSequence: text, workspace: { schemaVersion: 1, profileWindow: 9, source: { origin: 'catalog', accession, sequence: text, entryVersion: null, sequenceVersion: null, retrievedAt: null }, descriptors: { sequence: text, excluded: 0, methodVersion: 'proteinforge-descriptors-v1', result: calculateDescriptors(text) }, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
}
function wire(project: Project) {
  const { workspace } = project; const a = workspace.alignment;
  return {
    summary: { id: project.id, name: project.name, status: ProjectStatus.DRAFT, createTime: timestampFromIso(project.createdAt), updateTime: timestampFromIso(project.updatedAt), preview: {
      sequenceLength: project.activeSequence.length, sequencePrefix: prefix(project.activeSequence), excluded: 0,
      descriptors: workspace.descriptors?.result,
      source: workspace.source ? { origin: SourceOrigin.CATALOG, accession: workspace.source.accession } : undefined,
      alignment: a.first || a.second ? { firstLength: a.first.length, secondLength: a.second.length, firstPrefix: prefix(a.first), secondPrefix: prefix(a.second), matrix: SubstitutionMatrix[a.matrix], mode: a.mode === 'global' ? AlignmentMode.GLOBAL : AlignmentMode.LOCAL, result: a.result ? { identities: a.result.identities, similarities: a.result.similarities, columns: a.result.columns } : undefined } : undefined,
    } }, activeSequence: project.activeSequence, workspace: workspaceMessage(workspace),
  };
}

async function mockCollection(page: Page, leading: Project[] = []) {
  await storeSession(page);
  const human = analysis(HUMAN, 'Insulina humana', 'P01308');
  const first = sequence('P01308'); const second = sequence('P01317');
  const comparison: Project = { ...human, id: COMPARISON, name: 'Insulina humana y bovina', activeSequence: '', workspace: { ...human.workspace, descriptors: null, source: null, alignment: { first, second, mode: 'global', matrix: 'BLOSUM62', result: await alignSequences(first, second) } } };
  const documents = new Map([...leading, human, comparison, analysis(LYSOZYME, 'Lisozima C', 'P00698')].map(project => [project.id, project]));
  const gets: string[] = []; const queries: { query: string; order: ProjectOrder; pageToken: string }[] = [];
  let version = 0;
  let listError = false;
  await page.route(isRpc, async route => {
    const method = rpcMethod(route);
    if (method === 'AccountService/GetStatus') return fulfillRpc(route, GetStatusResponseSchema, { status: 'ok', version: '0.1.0', identityConfigured: true });
    if (method === 'AccountService/GetMe') return fulfillRpc(route, GetMeResponseSchema, { id: TEST_ACCOUNT.id, email: TEST_ACCOUNT.email });
    expect(route.request().headers().authorization).toBe(`Bearer ${TEST_ACCOUNT.accessToken}`);
    if (method === 'ProjectService/ListProjects') {
      const request = rpcRequest(route, ListProjectsRequestSchema); queries.push(request);
      if (listError) return fulfillRpcError(route, GRPC_CODES.unavailable, 'projects-unreachable');
      const filtered = [...documents.values()].filter(p => p.name.toLocaleLowerCase().includes(request.query.toLocaleLowerCase()));
      if (request.order === ProjectOrder.NAME) filtered.sort((a,b) => a.name.localeCompare(b.name));
      const offset = Number(request.pageToken || 0); const next = offset + 2;
      return fulfillRpc(route, ListProjectsResponseSchema, { queryApplied: true, projects: filtered.slice(offset, next).map(p => wire(p).summary), nextPageToken: next < filtered.length ? String(next) : '' });
    }
    if (method === 'ProjectService/GetProject') {
      const { id } = rpcRequest(route, GetProjectRequestSchema); gets.push(id); const project = documents.get(id);
      return project ? fulfillRpc(route, GetProjectResponseSchema, { project: wire(project) }) : fulfillRpcError(route, GRPC_CODES.notFound, 'project-not-found');
    }
    if (method === 'ProjectService/DeleteProject') {
      const request = rpcRequest(route, DeleteProjectRequestSchema); const project = documents.get(request.id);
      expect(isoFromTimestamp(request.expectedUpdateTime)).toBe(project?.updatedAt);
      documents.delete(request.id); return fulfillRpc(route, DeleteProjectResponseSchema, {});
    }
    const update = method === 'ProjectService/UpdateProject';
    const request = update ? rpcRequest(route, UpdateProjectRequestSchema) : rpcRequest(route, CreateProjectRequestSchema);
    const id = update ? rpcRequest(route, UpdateProjectRequestSchema).id : `00000000-0000-4000-8000-${String(20 + version).padStart(12,'0')}`;
    const previous = documents.get(id);
    if (update) expect(isoFromTimestamp(rpcRequest(route, UpdateProjectRequestSchema).expectedUpdateTime)).toBe(previous?.updatedAt);
    const project: Project = { ...human, id, name: request.name, activeSequence: request.activeSequence, workspace: workspaceDocument(request.workspace) as WorkspaceSnapshot, updatedAt: `2026-10-19T10:01:${String(++version).padStart(2,'0')}.123456Z` };
    documents.set(id, project); return fulfillRpc(route, update ? UpdateProjectResponseSchema : CreateProjectResponseSchema, { project: wire(project) });
  });
  return { documents, gets, queries, failList: (fail: boolean) => { listError = fail; } };
}

test('search covers later pages, resets the token and does not fetch full snapshots for previews', async ({ page }) => {
  const data = await mockCollection(page); await page.goto(ROUTES.projects);
  await expect(page.locator('.project-card')).toHaveCount(2);
  expect(data.gets).toEqual([]);
  await expect(page.getByRole('button', { name: spanish['projects.more'] })).toBeVisible();
  await page.getByRole('searchbox').fill('Lisozima'); await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Lisozima C' })).toBeVisible();
  expect(data.queries.at(-1)).toMatchObject({ query: 'Lisozima', pageToken: '' });
  await page.getByRole('combobox', { name: spanish['projects.order'] }).selectOption('name');
  await expect.poll(() => data.queries.at(-1)?.order).toBe(ProjectOrder.NAME);
  await page.getByRole('searchbox').fill('missing'); await page.getByRole('searchbox').press('Enter');
  await expect(page.getByText(spanish['projects.noMatches'])).toBeVisible();
  await page.getByRole('button', { name: spanish['projects.clearSearch'] }).click();
  await page.getByRole('button', { name: spanish['projects.more'] }).click();
  await expect(page.locator('.project-card')).toHaveCount(3);
  expect(data.gets).toEqual([]);
  data.failList(true); await page.getByRole('button', { name: spanish['projects.refresh'] }).click();
  await expect(page.locator('.project-feedback')).toContainText(spanish['projects.unavailable']);
  data.failList(false); await page.getByRole('button', { name: spanish['projects.refresh'] }).click();
  await expect(page.locator('.project-card')).toHaveCount(2);
});

test('copying preserves the current draft and pointer, and a comparison-only project opens Align', async ({ page }) => {
  const data = await mockCollection(page);
  await page.addInitScript(({ key, id }) => { localStorage.setItem(key, id); }, { key: `${PROJECT_POINTER_PREFIX}${TEST_ACCOUNT.id}`, id: HUMAN });
  await page.goto(ROUTES.analyze);
  await expect((await openProjectPanel(page)).getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue('Insulina humana');
  const editor = await openSequenceEditor(page); await editor.fill('ACDE');
  await followNavigation(page, spanish['nav.projects']);
  await page.getByLabel(message('projects.actionsNamed', { name: 'Insulina humana' }), { exact: true }).click();
  await page.getByRole('button', { name: message('projects.duplicateNamed', { name: 'Insulina humana' }) }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('textbox')).toBeFocused();
  await dialog.getByRole('textbox').fill('Copia guardada'); await dialog.getByRole('button', { name: spanish['projects.confirmDuplicate'] }).click();
  await expect(dialog).toBeHidden(); expect([...data.documents.values()].find(p => p.name === 'Copia guardada')?.activeSequence).toBe(sequence('P01308'));
  expect(await page.evaluate(key => localStorage.getItem(key), `${PROJECT_POINTER_PREFIX}${TEST_ACCOUNT.id}`)).toBe(HUMAN);
  await followNavigation(page, spanish['nav.analyze']); await expect(await openSequenceEditor(page)).toHaveValue('ACDE');
  await expect((await openProjectPanel(page)).getByRole('textbox', { name: spanish['projects.name'] })).toHaveValue('Insulina humana');
  await followNavigation(page, spanish['nav.projects']);
  await page.getByRole('button', { name: message('projects.openAlignmentNamed', { name: 'Insulina humana y bovina' }) }).click();
  await page.getByRole('dialog').getByRole('button', { name: spanish['projects.confirmOpen'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
});

test('a mixed project restores its saved comparison parameters and result, and opens its analysis separately', async ({ page }) => {
  // Mirrors the owner's saved project verified on 22 Oct: human/bovine with Global/BLOSUM80 plus an analysis sequence.
  const first = sequence('P01308'); const second = sequence('P01317'); const analysed = sequence('P00698');
  const result = await alignSequences(first, second, { matrix: 'BLOSUM80', mode: 'global' });
  expect([result.identities, result.columns, result.score]).toEqual([88, 110, 733]);
  const base = analysis(MIXED, 'Insulina comparada', 'P00698');
  const mixed: Project = { ...base, workspace: { ...base.workspace, alignment: { first, second, matrix: 'BLOSUM80', mode: 'global', result } } };
  await mockCollection(page, [mixed]); await page.goto(ROUTES.projects);
  const card = page.locator('.project-card').filter({ has: page.getByRole('heading', { name: 'Insulina comparada' }) });
  await expect(card.getByRole('button', { name: message('projects.openAnalysisNamed', { name: 'Insulina comparada' }) })).toBeVisible();

  await card.getByRole('button', { name: message('projects.openAlignmentNamed', { name: 'Insulina comparada' }) }).click();
  await page.getByRole('dialog').getByRole('button', { name: spanish['projects.confirmOpen'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
  await expect(page.locator('#alignment-first')).toHaveValue(first);
  await expect(page.locator('#alignment-second')).toHaveValue(second);
  await page.locator('.comparison-advanced summary').click();
  await expect(page.getByRole('radio', { name: 'BLOSUM80' })).toBeChecked();
  await expect(page.getByRole('radio', { name: spanish['alignment.global'] })).toBeChecked();
  await expect(page.getByText(message('alignment.verdict', { count: '88', total: '110' }))).toBeVisible();
  await expect(page.locator('.figures')).toContainText('733');
  await expect(page.getByText(spanish['alignment.stale'])).toHaveCount(0);

  await followNavigation(page, spanish['nav.projects']);
  await card.getByRole('button', { name: message('projects.openAnalysisNamed', { name: 'Insulina comparada' }) }).click();
  await page.getByRole('dialog').getByRole('button', { name: spanish['projects.confirmOpen'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(await openSequenceEditor(page)).toHaveValue(analysed);
  await followNavigation(page, spanish['nav.alignment']);
  await page.locator('.comparison-advanced summary').click();
  await expect(page.getByRole('radio', { name: 'BLOSUM80' })).toBeChecked();
  await expect(page.locator('#alignment-second')).toHaveValue(second);
});

for (const width of [360, 1280]) test(`approved cards, menus and confirmation fit ${String(width)}px in both themes`, async ({ page }) => {
  await mockCollection(page); await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.projects); await page.getByRole('button', { name: spanish['projects.more'] }).click();
  await expect(page.locator('.project-card')).toHaveCount(3);
  for (const theme of ['light','dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.evaluate(() => document.fonts.ready); await assertFits(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze(); expect(axe.violations).toEqual([]);
    await page.evaluate(() => { window.scrollTo(0, 0); });
    await page.screenshot({ path: `artifacts/projects-cards-${String(width)}-${theme}.png`, fullPage: true });
  }
  const summary = page.getByLabel(message('projects.actionsNamed', { name: 'Insulina humana' }), { exact: true });
  await summary.focus(); await summary.press('Enter');
  const remove = page.getByRole('button', { name: message('projects.deleteNamed', { name: 'Insulina humana' }) }); await expect(remove).toBeVisible();
  await remove.click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: spanish['projects.cancel'] })).toBeFocused();
  await dialog.press('Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await dialog.press('Escape'); await expect(dialog).toBeHidden(); await expect(summary).toBeFocused();
});

test('the project invitation and English collection stay usable without leaking saved data', async ({ page }) => {
  await page.goto(ROUTES.projects); await expect(page.getByText(spanish['projects.signInLibrary'])).toBeVisible();
  await expect(page.getByRole('link', { name: spanish['shell.signIn'], exact: true }).last()).toHaveAttribute('href', ROUTES.signIn);
  await mockCollection(page);
  await page.addInitScript(key => { localStorage.setItem(key, JSON.stringify({ locale: 'en', theme: 'dark' })); }, PREFERENCES_STORAGE_KEY);
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto(ROUTES.projects);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(english['projects.title']);
  await expect(page.getByRole('searchbox', { name: english['projects.search'] })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(2); await assertFits(page);
});
