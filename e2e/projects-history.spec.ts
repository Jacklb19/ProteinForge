import type { Page } from '@playwright/test';
import { expect, test } from './test';
import type { Project } from '../src/features/projects/contracts';
import { workspaceMessage } from '../src/features/projects/rpcMapping';
import { PROJECT_PREVIEW_RESIDUES } from '../src/features/projects/config';
import { isoFromTimestamp, timestampFromIso } from '../src/features/api/timestamps';
import {
  CreateProjectShareResponseSchema, DeleteProjectShareResponseSchema, GetProjectShareResponseSchema, GetSharedProjectRequestSchema,
  GetSharedProjectResponseSchema, ListProjectVersionsRequestSchema, ListProjectVersionsResponseSchema, ListProjectsResponseSchema,
  ProjectStatus, RestoreProjectVersionRequestSchema, RestoreProjectVersionResponseSchema,
} from '../src/gen/proteinforge/project/v1/project_service_pb';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { assertFits, message, storeSession, TEST_ACCOUNT } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

const PROJECT = '00000000-0000-4000-8000-000000000010';
const VERSION = '00000000-0000-4000-8000-000000000020';
const SAVED = '2026-11-12T09:00:00.123456Z';
const EARLIER = '2026-11-11T09:00:00.123456Z';
const RESTORED = '2026-11-13T09:00:00.123456Z';
const EXPIRES = '2026-11-20T09:00:00.123456Z';
const CURRENT = 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT';
const OLDER = 'GIVEQCCTSICSLYQLENYCN';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';

function project(activeSequence: string, updatedAt: string, name = 'Insulina humana'): Project {
  return { id: PROJECT, name, status: 'draft', createdAt: EARLIER, updatedAt, activeSequence, workspace: { schemaVersion: 1, profileWindow: 9, source: null, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
}
function preview(sequence: string) {
  return { sequenceLength: sequence.length, sequencePrefix: sequence.slice(0, PROJECT_PREVIEW_RESIDUES), excluded: 0 };
}
function summary(stored: Project) {
  return { id: stored.id, name: stored.name, status: ProjectStatus.DRAFT, createTime: timestampFromIso(stored.createdAt), updateTime: timestampFromIso(stored.updatedAt), preview: preview(stored.activeSequence) };
}
function wire(stored: Project) {
  return { summary: summary(stored), activeSequence: stored.activeSequence, workspace: workspaceMessage(stored.workspace) };
}

/** One project with one earlier version and no link; restoring and sharing change what later calls answer. */
async function mockHistory(page: Page) {
  await storeSession(page);
  let stored = project(CURRENT, SAVED);
  let versions = [{ id: VERSION, saveTime: timestampFromIso(EARLIER), preview: preview(OLDER) }];
  let link: string | null = null;
  const calls: { method: string; authorization?: string }[] = [];
  await page.route(isRpc, async route => {
    const method = rpcMethod(route);
    calls.push({ method, authorization: route.request().headers().authorization });
    if (method === 'ProjectService/GetSharedProject') return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unexpected');
    expect(route.request().headers().authorization).toBe(`Bearer ${TEST_ACCOUNT.accessToken}`);
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, { queryApplied: true, projects: [summary(stored)] });
    if (method === 'ProjectService/ListProjectVersions') {
      expect(rpcRequest(route, ListProjectVersionsRequestSchema).projectId).toBe(PROJECT);
      return fulfillRpc(route, ListProjectVersionsResponseSchema, { versions });
    }
    if (method === 'ProjectService/RestoreProjectVersion') {
      const request = rpcRequest(route, RestoreProjectVersionRequestSchema);
      expect({ project: request.projectId, version: request.versionId, expected: isoFromTimestamp(request.expectedUpdateTime) }).toEqual({ project: PROJECT, version: VERSION, expected: SAVED });
      // What was current becomes the only earlier version, so the restore can be undone.
      versions = [{ id: '00000000-0000-4000-8000-000000000021', saveTime: timestampFromIso(SAVED), preview: preview(CURRENT) }];
      stored = project(OLDER, RESTORED);
      return fulfillRpc(route, RestoreProjectVersionResponseSchema, { project: wire(stored) });
    }
    if (method === 'ProjectService/GetProjectShare') return fulfillRpc(route, GetProjectShareResponseSchema, link ? { share: { createTime: timestampFromIso(SAVED), expireTime: timestampFromIso(EXPIRES) } } : {});
    if (method === 'ProjectService/CreateProjectShare') { link = TOKEN; return fulfillRpc(route, CreateProjectShareResponseSchema, { token: TOKEN, share: { createTime: timestampFromIso(SAVED), expireTime: timestampFromIso(EXPIRES) } }); }
    if (method === 'ProjectService/DeleteProjectShare') { link = null; return fulfillRpc(route, DeleteProjectShareResponseSchema, {}); }
    return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
  });
  return { calls, link: () => link, stored: () => stored };
}

for (const width of [360, 1280]) test(`an earlier version is restored after confirming and can be undone at ${String(width)}px`, async ({ page }) => {
  const data = await mockHistory(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.projects);
  const card = page.getByRole('article', { name: 'Insulina humana' });
  await expect(card.locator('.project-length')).toHaveText(message('fasta.residues', { count: CURRENT.length }));
  await card.getByText(spanish['versions.title'], { exact: true }).click();
  const list = card.getByRole('list', { name: message('versions.listOf', { project: 'Insulina humana' }) });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(message('fasta.residues', { count: OLDER.length }));
  await list.getByRole('button', { name: spanish['versions.restore'] }).click();
  const confirm = list.getByRole('group');
  await expect(confirm.getByRole('button', { name: spanish['projects.cancel'] })).toBeFocused();
  await expect(confirm).toContainText(spanish['versions.confirmHelp']);
  await assertFits(page);
  await confirm.getByRole('button', { name: spanish['versions.restore'] }).click();
  await expect(card.locator('.project-length')).toHaveText(message('fasta.residues', { count: OLDER.length }));
  // The content that was current is now the earlier version, ready to be restored back.
  await expect(list).toContainText(message('fasta.residues', { count: CURRENT.length }));
  await expect(card.locator('.project-versions summary')).toBeFocused();
  expect(data.calls.filter(call => call.method === 'ProjectService/RestoreProjectVersion')).toHaveLength(1);
  expect(data.stored().activeSequence).toBe(OLDER);
  await assertFits(page);
});

for (const width of [360, 1280]) test(`a read-only link opens without a session and stops working once revoked at ${String(width)}px`, async ({ page, browser, baseURL }) => {
  const data = await mockHistory(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.projects);
  await page.getByLabel(message('projects.actionsNamed', { name: 'Insulina humana' }), { exact: true }).click();
  await page.getByRole('button', { name: message('projects.shareNamed', { name: 'Insulina humana' }) }).click();
  const dialog = page.getByRole('dialog', { name: spanish['share.title'] });
  await expect(dialog.getByText(spanish['share.none'])).toBeVisible();
  await dialog.getByRole('button', { name: spanish['share.create'] }).click();
  const field = dialog.getByRole('textbox', { name: spanish['share.link'] });
  await expect(field).toHaveValue(`${new URL(baseURL ?? '').origin}${ROUTES.shared}#${TOKEN}`);
  await assertFits(page);
  const address = await field.inputValue();

  // Someone else, in a browser with no account and no stored session, opens the address.
  const visitor = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const guest = await visitor.newPage();
  const guestCalls: { token: string; authorization?: string }[] = [];
  await guest.route('**/auth/v1/**', route => route.fulfill({ status: 401, json: {} }));
  await guest.route(isRpc, async route => {
    if (rpcMethod(route) !== 'ProjectService/GetSharedProject') return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
    const { token } = rpcRequest(route, GetSharedProjectRequestSchema);
    guestCalls.push({ token, authorization: route.request().headers().authorization });
    if (token !== data.link()) return fulfillRpcError(route, GRPC_CODES.notFound, 'shared-not-found');
    const stored = data.stored();
    return fulfillRpc(route, GetSharedProjectResponseSchema, { project: { name: stored.name, activeSequence: stored.activeSequence, workspace: workspaceMessage(stored.workspace), updateTime: timestampFromIso(stored.updatedAt), expireTime: timestampFromIso(EXPIRES) } });
  });
  await guest.goto(address);
  await expect(guest.getByRole('heading', { level: 1 })).toHaveText('Insulina humana');
  await expect(guest.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(guest.getByText(message('fasta.residues', { count: CURRENT.length })).first()).toBeVisible();
  // Development mode may run the page's effect twice; every request carries the token and no session.
  expect(guestCalls.length).toBeGreaterThan(0);
  expect(guestCalls.every(call => call.token === TOKEN && call.authorization === undefined)).toBe(true);
  const opened = guestCalls.length;
  expect(await guest.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await dialog.getByRole('button', { name: spanish['share.stop'] }).click();
  await expect(dialog.getByText(spanish['share.none'])).toBeVisible();
  expect(data.link()).toBeNull();
  await guest.reload();
  await expect(guest.getByRole('heading', { level: 1 })).toHaveText(spanish['shared.missingTitle']);
  await expect(guest.getByText(spanish['shared.missing'])).toBeVisible();
  expect(guestCalls.length).toBeGreaterThan(opened);
  expect(guestCalls.every(call => call.authorization === undefined)).toBe(true);
  await visitor.close();
});
