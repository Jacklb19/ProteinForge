import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { timestampFromIso } from '../src/features/api/timestamps';
import { PROJECT_PREVIEW_RESIDUES } from '../src/features/projects/config';
import {
  CreateProjectShareRequestSchema, CreateProjectShareResponseSchema, DeleteProjectShareResponseSchema, GetProjectShareResponseSchema,
  ListProjectsResponseSchema, ProjectStatus,
} from '../src/gen/proteinforge/project/v1/project_service_pb';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, message, setTheme, storeSession } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

const SHARED = '00000000-0000-4000-8000-000000000010';
const PRIVATE = '00000000-0000-4000-8000-000000000011';
const SAVED = '2026-11-12T09:00:00.123456Z';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';
const SEQUENCE = 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT';
const DAY_MS = 86_400_000;

/** Two projects, one with a link that ends in three days; creating and ending links changes what is answered. */
async function mockLinks(page: Page) {
  await storeSession(page);
  const links = new Map<string, string>([[SHARED, new Date(Date.now() + 3 * DAY_MS).toISOString()]]);
  const created: number[] = [];
  const summary = (id: string, name: string) => ({
    id, name, status: ProjectStatus.DRAFT, createTime: timestampFromIso(SAVED), updateTime: timestampFromIso(SAVED),
    preview: { sequenceLength: SEQUENCE.length, sequencePrefix: SEQUENCE.slice(0, PROJECT_PREVIEW_RESIDUES), excluded: 0, source: undefined },
    ...(links.has(id) ? { shareExpireTime: timestampFromIso(links.get(id) ?? SAVED) } : {}),
  });
  await page.route(isRpc, async route => {
    const method = rpcMethod(route);
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, { queryApplied: true, projects: [summary(SHARED, 'Insulina humana'), summary(PRIVATE, 'Lisozima C')] });
    if (method === 'ProjectService/GetProjectShare') return fulfillRpc(route, GetProjectShareResponseSchema, {});
    if (method === 'ProjectService/CreateProjectShare') {
      const request = rpcRequest(route, CreateProjectShareRequestSchema);
      created.push(request.durationDays);
      const expires = new Date(Date.now() + request.durationDays * DAY_MS).toISOString();
      links.set(request.projectId, expires);
      return fulfillRpc(route, CreateProjectShareResponseSchema, { token: TOKEN, share: { createTime: timestampFromIso(new Date().toISOString()), expireTime: timestampFromIso(expires) } });
    }
    if (method === 'ProjectService/DeleteProjectShare') { links.clear(); return fulfillRpc(route, DeleteProjectShareResponseSchema, {}); }
    return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
  });
  return { created };
}

for (const width of [360, 1280]) test(`a card says until when it is shared and a new link lasts the days chosen at ${String(width)}px`, async ({ page }) => {
  const data = await mockLinks(page);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.projects);
  const shared = page.getByRole('article', { name: 'Insulina humana' });
  const other = page.getByRole('article', { name: 'Lisozima C' });
  await expect(shared.locator('.project-shared')).toHaveText(/^Compartido para leer hasta el /);
  await expect(other.locator('.project-shared')).toHaveCount(0);
  // The line sits above the length, under the name and origin.
  expect(await shared.evaluate(card => {
    const line = card.querySelector('.project-shared'); const length = card.querySelector('.project-length');
    return Boolean(line && length && line.compareDocumentPosition(length) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  await page.getByLabel(message('projects.actionsNamed', { name: 'Lisozima C' }), { exact: true }).click();
  await page.getByRole('button', { name: message('projects.shareNamed', { name: 'Lisozima C' }) }).click();
  const dialog = page.getByRole('dialog', { name: spanish['share.title'] });
  const duration = dialog.getByRole('group', { name: spanish['share.duration'] });
  await expect(duration.getByRole('radio', { name: message('share.days', { count: 7 }) })).toBeChecked();
  await expect(dialog.locator('#share-until')).toHaveText(/^Dejará de funcionar el /);
  const seven = await dialog.locator('#share-until').textContent();
  await duration.getByRole('radio', { name: message('share.days', { count: 30 }) }).check();
  await expect(dialog.locator('#share-until')).not.toHaveText(seven ?? '');
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await assertFits(page);
    const axe = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  }
  await dialog.getByRole('button', { name: spanish['share.create'] }).click();
  await expect(dialog.getByRole('textbox', { name: spanish['share.link'] })).toHaveValue(new RegExp(`#${TOKEN}$`));
  expect(data.created).toEqual([30]);
  await expect(other.locator('.project-shared')).toHaveText(/^Compartido para leer hasta el /);
  await dialog.getByRole('button', { name: spanish['share.stop'] }).click();
  await expect(dialog.getByText(spanish['share.none'])).toBeVisible();
  await dialog.getByRole('button', { name: spanish['share.close'] }).click();
  await expect(other.locator('.project-shared')).toHaveCount(0);
});
