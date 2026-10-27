import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Project, WorkspaceSnapshot } from '../src/features/projects/contracts';
import { workspaceDocument, workspaceMessage } from '../src/features/projects/rpcMapping';
import { timestampFromIso } from '../src/features/api/timestamps';
import { GetMeResponseSchema, GetStatusResponseSchema } from '../src/gen/proteinforge/account/v1/account_service_pb';
import {
  GetProjectResponseSchema, ListProjectsResponseSchema, ProjectStatus, UpdateProjectRequestSchema, UpdateProjectResponseSchema,
} from '../src/gen/proteinforge/project/v1/project_service_pb';
import { addGeneratorRun, createGeneratorRun, generatorHistoryRuns } from '../src/features/generator/history';
import type { GeneratorHistorySnapshot } from '../src/features/generator/history';
import { PROJECT_POINTER_PREFIX } from '../src/features/projects/config';
import { PREFERENCES_STORAGE_KEY } from '../src/preferences/config';
import { ROUTES } from '../src/shared/navigation';
import { translate } from '../src/i18n/translate';
import type { TranslationKey, TranslationVariables } from '../src/i18n/translate';
import type { Locale } from '../src/i18n/config';
import { assertFits, storeSession, TEST_ACCOUNT } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

// The page opens on a search of its initial conditions, which is exactly this bundled export.
const exported = readFileSync(new URL('../src/test/generator-exports/default-export.json', import.meta.url), 'utf8');
const EXPORT_ID = 'c276bf594f50d9e89730ffc12ed3d96539bc08431828cf0081b07be5f1587de0';
const ID = '00000000-0000-4000-8000-000000000010';
const DATE = '2026-10-27T08:00:00.123456Z';
const base: Project = { id: ID, name: 'Insulina', activeSequence: 'ACDEFGHIKLMNPQRSTVWY', status: 'draft', createdAt: DATE, updatedAt: DATE,
  workspace: { schemaVersion: 1, profileWindow: 9, source: null, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };

async function history(texts: string[]): Promise<GeneratorHistorySnapshot> {
  let value: GeneratorHistorySnapshot | null = null;
  for (const text of texts) value = (await addGeneratorRun(value, await createGeneratorRun(text, { recordedAt: '2026-10-27T13:00:00.000Z', appBuild: 'a4f5001', selection: null }))).history;
  if (!value) throw new Error('No runs');
  return value;
}
function seeded(seed: number): string {
  const result = JSON.parse(exported) as { parameters: { seed: number } };
  result.parameters.seed = seed;
  return JSON.stringify(result, null, 2);
}
function projectMessage(project: Project) {
  const runs = project.workspace.generatorHistory ? generatorHistoryRuns(project.workspace.generatorHistory).length : 0;
  return {
    summary: { id: project.id, name: project.name, status: ProjectStatus.DRAFT, createTime: timestampFromIso(project.createdAt), updateTime: timestampFromIso(project.updatedAt),
      preview: { sequenceLength: project.activeSequence.length, sequencePrefix: project.activeSequence.slice(0, 40), excluded: 0, generatorRuns: runs } },
    activeSequence: project.activeSequence, workspace: workspaceMessage(project.workspace),
  };
}

/** Owner with one project open in Analyze; writes are kept so the test can read what was sent. */
async function mockApi(page: Page, initial: Project, options: { locale?: Locale; theme?: 'light' | 'dark'; refuse?: string } = {}) {
  let project = initial; let version = 0;
  const writes: WorkspaceSnapshot[] = [];
  await storeSession(page);
  await page.addInitScript(({ pointer, id, key, preferences }) => {
    localStorage.setItem(pointer, id);
    localStorage.setItem(key, JSON.stringify(preferences));
  }, { pointer: `${PROJECT_POINTER_PREFIX}${TEST_ACCOUNT.id}`, id: ID, key: PREFERENCES_STORAGE_KEY, preferences: { locale: options.locale ?? 'es', theme: options.theme ?? 'light' } });
  await page.route(isRpc, async (route) => {
    const method = rpcMethod(route);
    if (method === 'AccountService/GetStatus') return fulfillRpc(route, GetStatusResponseSchema, { status: 'ok', version: '0.1.0', identityConfigured: true });
    if (method === 'AccountService/GetMe') return fulfillRpc(route, GetMeResponseSchema, { id: TEST_ACCOUNT.id, email: TEST_ACCOUNT.email });
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, { projects: [projectMessage(project).summary] });
    if (method === 'ProjectService/GetProject') return fulfillRpc(route, GetProjectResponseSchema, { project: projectMessage(project) });
    if (method === 'ProjectService/UpdateProject') {
      if (options.refuse) return fulfillRpcError(route, GRPC_CODES.aborted, options.refuse, 'e2e-history');
      const request = rpcRequest(route, UpdateProjectRequestSchema);
      const workspace = workspaceDocument(request.workspace) as WorkspaceSnapshot;
      writes.push(workspace);
      project = { ...project, name: request.name, activeSequence: request.activeSequence, workspace, updatedAt: `2026-10-27T08:00:${String(++version).padStart(2, '0')}.123456Z` };
      return fulfillRpc(route, UpdateProjectResponseSchema, { project: projectMessage(project) });
    }
    return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
  });
  return writes;
}

async function openGenerator(page: Page, locale: Locale = 'es') {
  const t = (key: TranslationKey, variables?: TranslationVariables) => translate(locale, key, variables);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.generate);
  await expect(page.getByRole('status').filter({ hasText: t('generator.done') })).toBeVisible();
  await expect(page.getByText(t('generator.savesTo', { project: base.name }))).toBeVisible();
  return t;
}

test('saves the exact search with its candidate, checks it on demand and removes it, without touching the analysis', async ({ page }) => {
  const writes = await mockApi(page, base);
  const t = await openGenerator(page);
  await page.getByRole('button', { name: t('generator.saveToProject'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: t('generator.saveTitle') });
  await expect(dialog.getByRole('button', { name: t('generator.saveCancel'), exact: true })).toBeFocused();
  await dialog.getByLabel(t('generator.chosen')).selectOption('guided:0');
  await dialog.getByRole('button', { name: t('generator.save'), exact: true }).click();
  await expect(page.getByText(t('generator.savedTo', { project: base.name }))).toBeVisible();
  const saved = writes.at(-1);
  expect(saved).toMatchObject({ schemaVersion: 3, alignment: base.workspace.alignment, profileWindow: 9 });
  const runs = saved?.generatorHistory ? generatorHistoryRuns(saved.generatorHistory) : [];
  expect(runs.map((run) => [run.id, run.resultJson === exported, run.selection])).toEqual([[EXPORT_ID, true, { arm: 'guided', index: 0 }]]);

  const entry = page.locator('.generator-run');
  await expect(entry).toHaveCount(1);
  await entry.getByRole('button', { name: t('generator.reproduce'), exact: true }).click();
  await expect(entry.getByText(t('generator.identical'))).toBeVisible({ timeout: 60_000 });

  await entry.getByRole('button', { name: t('generator.removeRun'), exact: true }).click();
  await expect(entry.getByRole('button', { name: t('generator.removeKeep'), exact: true })).toBeFocused();
  await entry.getByRole('button', { name: t('generator.removeConfirm'), exact: true }).click();
  await expect(page.getByText(t('generator.historyEmpty'))).toBeVisible();
  expect(writes.at(-1)).toMatchObject({ schemaVersion: 3, alignment: base.workspace.alignment });
  expect(writes.at(-1)?.generatorHistory ?? null).toBeNull();
});

for (const locale of ['es', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`saved searches fit and pass AA at 360 and 1280 px (${locale}, ${theme})`, async ({ page }) => {
    await mockApi(page, { ...base, workspace: { ...base.workspace, schemaVersion: 3, generatorHistory: await history([exported, seeded(7)]) } }, { locale, theme });
    const t = await openGenerator(page, locale);
    await expect(page.locator('.generator-run')).toHaveCount(2);
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await assertFits(page);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await page.getByRole('heading', { name: t('generator.historyTitle') }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/generator-history-${locale}-${theme}-${String(width)}.png` });
    }
  });
}

test('refuses an eleventh search before writing and explains a newer stored project', async ({ page }) => {
  const writes = await mockApi(page, { ...base, workspace: { ...base.workspace, schemaVersion: 3, generatorHistory: await history(Array.from({ length: 10 }, (_, index) => seeded(index + 100))) } });
  const t = await openGenerator(page);
  await page.getByRole('button', { name: t('generator.saveToProject'), exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: t('generator.save'), exact: true }).click();
  await expect(page.getByText(t('generator.historySize'))).toBeVisible();
  await expect(page.getByRole('link', { name: t('generator.fullChoose') })).toBeVisible();
  expect(writes).toEqual([]);
  await expect(page.locator('.generator-run')).toHaveCount(10);
});

test('a project saved by a newer version is not overwritten', async ({ page }) => {
  await mockApi(page, base, { refuse: 'project-requires-current-client' });
  const t = await openGenerator(page);
  await page.getByRole('button', { name: t('generator.saveToProject'), exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: t('generator.save'), exact: true }).click();
  await expect(page.getByText(t('projects.requiresCurrentClient'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('generator.reload'), exact: true })).toBeVisible();
  await expect(page.getByText(t('projects.conflict'))).toHaveCount(0);
});

test('without a session the search and its download stay available and saving invites to sign in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.generate);
  const t = (key: TranslationKey) => translate('es', key);
  await expect(page.getByText(t('generator.signedOutNote'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('generator.download'), exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: t('generator.saveToProject'), exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: t('generator.historyTitle') })).toHaveCount(0);
});

test('Projects counts saved searches and opens them in Design', async ({ page }) => {
  await mockApi(page, { ...base, workspace: { ...base.workspace, schemaVersion: 3, generatorHistory: await history([exported, seeded(7)]) } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.projects);
  const t = (key: TranslationKey, variables?: TranslationVariables) => translate('es', key, variables);
  const card = page.getByRole('article', { name: base.name });
  await expect(card.getByText(t('projects.generatorRuns', { count: '2' }))).toBeVisible();
  await card.getByRole('button', { name: t('projects.openRunsNamed', { name: base.name }) }).click();
  const confirm = page.getByRole('dialog');
  if (await confirm.isVisible()) await confirm.getByRole('button', { name: t('projects.confirmOpen') }).click();
  await expect(page).toHaveURL(new RegExp(ROUTES.generate));
  await expect(page.locator('.generator-run')).toHaveCount(2);
});
