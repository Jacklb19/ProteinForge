import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { timestampFromIso } from '../src/features/api/timestamps';
import { PROJECT_PREVIEW_RESIDUES } from '../src/features/projects/config';
import { ListProjectVersionsResponseSchema, ListProjectsResponseSchema, ProjectStatus } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { AlignmentMode, SubstitutionMatrix } from '../src/gen/proteinforge/project/v1/workspace_pb';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, message, setTheme, storeSession } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod } from './rpc';

const PROJECT = '00000000-0000-4000-8000-000000000010';
const SAVED = '2026-11-13T09:00:00.123456Z';
const preview = (length: number, comparedWith?: number) => ({
  sequenceLength: length, sequencePrefix: 'M'.repeat(Math.min(length, PROJECT_PREVIEW_RESIDUES)), excluded: 0,
  ...(comparedWith ? { alignment: { firstLength: length, secondLength: comparedWith, firstPrefix: 'M'.repeat(Math.min(length, PROJECT_PREVIEW_RESIDUES)), secondPrefix: 'C'.repeat(Math.min(comparedWith, PROJECT_PREVIEW_RESIDUES)), matrix: SubstitutionMatrix.BLOSUM62, mode: AlignmentMode.GLOBAL } } : {}),
});
const version = (id: number, day: number, saved: ReturnType<typeof preview>, sameSequence: boolean) => ({
  id: `00000000-0000-4000-8000-0000000000${String(20 + id)}`, saveTime: timestampFromIso(`2026-11-${String(day).padStart(2, '0')}T16:10:00.000000Z`), preview: saved, sameSequence,
});

async function mockVersions(page: Page): Promise<void> {
  await storeSession(page);
  await page.route(isRpc, async route => {
    const method = rpcMethod(route);
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, { queryApplied: true, projects: [{ id: PROJECT, name: 'Insulina humana', status: ProjectStatus.DRAFT, createTime: timestampFromIso(SAVED), updateTime: timestampFromIso(SAVED), preview: preview(110) }] });
    if (method === 'ProjectService/ListProjectVersions') return fulfillRpc(route, ListProjectVersionsResponseSchema, { versions: [
      version(0, 12, preview(110, 105), true), version(1, 11, preview(51), false), version(2, 10, preview(110), false), version(3, 9, preview(110), true),
    ] });
    return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
  });
}

for (const width of [360, 1280]) test(`each earlier version says what it holds against the current one at ${String(width)}px`, async ({ page }) => {
  await mockVersions(page);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.projects);
  const card = page.getByRole('article', { name: 'Insulina humana' });
  await card.getByText(spanish['versions.title'], { exact: true }).click();
  const list = card.getByRole('list', { name: message('versions.listOf', { project: 'Insulina humana' }) });
  await expect(list.locator('.version-change')).toHaveText([
    'Frente a la actual: la misma secuencia; además tenía una comparación con otra de 105 residuos.',
    'Frente a la actual: 59 residuos menos.',
    'Frente a la actual: la misma longitud, secuencia distinta.',
    spanish['versions.sameAsCurrent'],
  ]);
  // The sentence follows the version's own details, above its restore button.
  const first = list.getByRole('listitem').first();
  expect(await first.evaluate(item => item.querySelector('.report-row-meta')?.nextElementSibling?.className)).toBe('version-change');
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await assertFits(page);
    const axe = await new AxeBuilder({ page }).include('.project-versions').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  }
});
