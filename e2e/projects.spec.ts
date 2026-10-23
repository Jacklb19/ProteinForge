import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Project, ProjectWrite, WorkspaceSnapshot } from '../src/features/projects/contracts';
import { workspaceDocument, workspaceMessage } from '../src/features/projects/rpcMapping';
import { isoFromTimestamp, timestampFromIso } from '../src/features/api/timestamps';
import { GetMeResponseSchema, GetStatusResponseSchema } from '../src/gen/proteinforge/account/v1/account_service_pb';
import {
  CreateProjectRequestSchema, CreateProjectResponseSchema, DeleteProjectResponseSchema, GetProjectResponseSchema,
  ListProjectsResponseSchema, ProjectStatus, UpdateProjectRequestSchema, UpdateProjectResponseSchema,
} from '../src/gen/proteinforge/project/v1/project_service_pb';
import { PROJECT_POINTER_PREFIX } from '../src/features/projects/config';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { alignmentInputs, assertFits, followNavigation, message, navigationLink, openProjectPanel, openSequenceEditor, storeSession, TEST_ACCOUNT } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

const ID = '00000000-0000-4000-8000-000000000010';
const USER = TEST_ACCOUNT.id;
const DATE = '2026-10-12T08:00:00.123456Z';
const saved: Project = { id: ID, name: 'Insulina', activeSequence: 'ACDEFGHIKLMNPQRSTVWY', status: 'draft', createdAt: DATE, updatedAt: DATE, workspace: { schemaVersion: 1, profileWindow: 19, descriptors: null, alignment: { first: 'ACD', second: 'ACE', matrix: 'BLOSUM80', mode: 'local', result: null } } };

/** Domain project as the messages the API sends. */
function projectMessage(project: Project) {
  return {
    summary: { id: project.id, name: project.name, status: ProjectStatus.DRAFT, createTime: timestampFromIso(project.createdAt), updateTime: timestampFromIso(project.updatedAt), ...(project.workspace.laboratory ? {preview:{sequenceLength:project.activeSequence.length,sequencePrefix:project.activeSequence.slice(0,40),hasLaboratory:true,laboratoryVariants:Object.keys((JSON.parse(project.workspace.laboratory.documentJson) as {state:{drafts:object}}).state.drafts).length}}:{}) },
    activeSequence: project.activeSequence, workspace: workspaceMessage(project.workspace),
  };
}

async function mockProjects(page: Page, initial: Project | null = null) {
  let project = initial; let version = 0; let conflict = false;
  const writes: ProjectWrite[] = [];
  let heldOpen: { gate: Promise<void>; start: () => void } | null = null;
  await storeSession(page);
  await page.route(isRpc, async (route) => {
    const method = rpcMethod(route);
    if (method === 'AccountService/GetStatus') return fulfillRpc(route, GetStatusResponseSchema, { status: 'ok', version: '0.1.0', identityConfigured: true });
    if (method === 'AccountService/GetMe') return fulfillRpc(route, GetMeResponseSchema, { id: USER, email: TEST_ACCOUNT.email });
    expect(route.request().headers().authorization).toBe(`Bearer ${TEST_ACCOUNT.accessToken}`);
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, { projects: project ? [projectMessage(project).summary] : [] });
    if (method === 'ProjectService/GetProject') {
      const held = heldOpen; heldOpen = null;
      if (held) { held.start(); await held.gate; }
      return project ? fulfillRpc(route, GetProjectResponseSchema, { project: projectMessage(project) }) : fulfillRpcError(route, GRPC_CODES.notFound, 'not-found');
    }
    if (method === 'ProjectService/DeleteProject') { project = null; return fulfillRpc(route, DeleteProjectResponseSchema, {}); }
    if (conflict && method === 'ProjectService/UpdateProject') return fulfillRpcError(route, GRPC_CODES.aborted, 'project-conflict', 'e2e-conflict');
    const update = method === 'ProjectService/UpdateProject';
    const request = update ? rpcRequest(route, UpdateProjectRequestSchema) : rpcRequest(route, CreateProjectRequestSchema);
    if (update) expect(isoFromTimestamp(rpcRequest(route, UpdateProjectRequestSchema).expectedUpdateTime)).toBe(project?.updatedAt);
    const write = { name: request.name, activeSequence: request.activeSequence, workspace: workspaceDocument(request.workspace) as WorkspaceSnapshot };
    writes.push(write);
    project = { ...saved, ...write, updatedAt: `2026-10-12T08:00:${String(++version).padStart(2, '0')}.123456Z` };
    return fulfillRpc(route, update ? UpdateProjectResponseSchema : CreateProjectResponseSchema, { project: projectMessage(project) });
  });
  return { writes, holdNextOpen: () => {
    let release!: () => void, start!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { start = resolve; });
    heldOpen = { gate, start }; return { release, started };
  }, setConflict: () => { conflict = true; }, clearConflict:()=>{conflict=false;}, corrupt:()=>{if(project?.workspace.laboratory)project={...project,workspace:{...project.workspace,laboratory:{...project.workspace.laboratory,documentSha256:'0'.repeat(64)}}};}, current: () => project };
}

/** Dedicated project collection. */
function projectLibrary(page: Page): Locator {
  return page.getByRole('region', { name: spanish['projects.title'] });
}

test('a delayed resume preserves sequence edits made after reload', async ({ page }) => {
  const data = await mockProjects(page, saved), held = data.holdNextOpen();
  await page.addInitScript(({ key, id }) => { localStorage.setItem(key, id); }, { key: `${PROJECT_POINTER_PREFIX}${USER}`, id: ID });
  await page.goto(ROUTES.analyze);
  await held.started;
  const editor = await openSequenceEditor(page);
  await editor.fill('MKWV');
  held.release();
  const panel = await openProjectPanel(page);
  await panel.getByLabel(spanish['projects.name']).fill('Preserved draft');
  await expect(panel.getByRole('button', { name: spanish['projects.create'], exact: true })).toBeEnabled();
  await expect(await openSequenceEditor(page)).toHaveValue('MKWV');
  expect(data.writes).toHaveLength(0);
});

for (const width of [360, 1280]) test(`a delayed laboratory open preserves newer edits at ${String(width)}px`, async ({ page }) => {
  const data = await mockProjects(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ROUTES.laboratory);
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: spanish['lab.saveProject'], exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(spanish['projects.name']).fill('Race laboratory');
  await dialog.getByRole('button', { name: spanish['projects.create'], exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await followNavigation(page, spanish['nav.projects']);
  const held = data.holdNextOpen();
  await projectLibrary(page).getByRole('button', { name: message('lab.openProjectNamed', { name: 'Race laboratory' }) }).click();
  await held.started;
  await followNavigation(page, spanish['nav.generate']);
  await page.getByRole('link', { name: spanish['lab.openLaboratory'], exact: true }).click();
  await page.getByRole('button', { name: spanish['lab.protect'], exact: true }).click();
  held.release();
  const save = page.getByRole('button', { name: spanish['lab.saveProject'], exact: true });
  await expect(save).toBeEnabled();
  await save.click(); dialog = page.getByRole('dialog');
  await expect(dialog.getByText(spanish['projects.draftChanged'], { exact: true })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await assertFits(page);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `artifacts/laboratory-race-${String(width)}-${theme}.png`, fullPage: true });
  }
  await page.keyboard.press('Escape'); await expect(save).toBeFocused();
  await expect(page.getByRole('button', { name: spanish['lab.unprotect'], exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(1);
});

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

test('the profile links to the project collection, which renames and deletes deliberately', async ({ page }) => {
  const data = await mockProjects(page, { ...saved, name: 'Estudio inicial' });
  await page.goto(ROUTES.analyze);
  await page.getByRole('link', { name: message('shell.account', { email: TEST_ACCOUNT.email }) }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
  await expect(page.locator('.project-grid')).toHaveCount(0);
  await page.getByRole('link', { name: spanish['projects.listLink'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.projects}$`));
  const library = projectLibrary(page);
  await expect(page.getByRole('heading', { level: 1, name: spanish['projects.title'] })).toBeVisible();
  await expect(library.locator('.project-grid')).toContainText('Estudio inicial');
  await library.getByLabel(message('projects.actionsNamed', { name: 'Estudio inicial' })).click();
  await library.getByRole('button', { name: message('projects.renameNamed', { name: 'Estudio inicial' }) }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: spanish['projects.name'] }).fill('Estudio revisado');
  await page.getByRole('dialog').getByRole('button', { name: spanish['projects.confirmRename'] }).click();
  await expect(library.locator('.project-grid')).toContainText('Estudio revisado');
  expect(data.writes.at(-1)?.name).toBe('Estudio revisado');
  expect(data.writes.at(-1)?.activeSequence).toBe(saved.activeSequence);
  await library.getByRole('button', { name: spanish['projects.refresh'], exact: true }).click();
  await expect(library.locator('.project-grid')).toContainText('Estudio revisado');
  await library.getByLabel(message('projects.actionsNamed', { name: 'Estudio revisado' })).click();
  await library.getByRole('button', { name: message('projects.deleteNamed', { name: 'Estudio revisado' }) }).click();
  await expect(page.getByText(spanish['projects.deleteWarning'])).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: spanish['projects.cancel'], exact: true }).click();
  expect(data.current()).not.toBeNull();
  await library.getByLabel(message('projects.actionsNamed', { name: 'Estudio revisado' })).click();
  await library.getByRole('button', { name: message('projects.deleteNamed', { name: 'Estudio revisado' }) }).click();
  await page.getByRole('dialog').getByRole('button', { name: spanish['projects.confirmDelete'], exact: true }).click();
  await expect(library.locator('.project-feedback')).toContainText(spanish['projects.deleted']);
  await expect(page.getByText(spanish['projects.emptyTitle'])).toBeVisible();
  expect(data.current()).toBeNull();
});

test('a conflict keeps edits, and opening a project restores profile and comparison parameters', async ({ page }) => {
  const data = await mockProjects(page, saved);
  await page.goto(ROUTES.projects);
  await projectLibrary(page).getByRole('button', { name: message('projects.openNamed', { name: saved.name }) }).click();
  // The visit already holds the bundled example, so replacing it is confirmed first.
  await expect(page.getByText(spanish['projects.replaceWarning'])).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.projects}$`));
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
    await page.goto(ROUTES.projects);
    await expect(page.locator('.project-grid')).toContainText(saved.name);
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

test('laboratory projects keep drafts, conflicts, atomic imports and independent analysis binding', async ({ page }) => {
  const api=await mockProjects(page,saved);
  // The analysis editor already belongs to a different project.
  await page.addInitScript(({prefix,user,id})=>{localStorage.setItem(prefix+user,id);},{prefix:PROJECT_POINTER_PREFIX,user:USER,id:ID});
  await page.goto(ROUTES.laboratory);
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await page.getByRole('button',{name:spanish['lab.protect'],exact:true}).click();
  await page.getByRole('button',{name:spanish['lab.saveProject'],exact:true}).click();
  let dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:spanish['projects.create'],exact:true})).toBeVisible();
  await dialog.getByLabel(spanish['projects.name']).fill('Laboratorio guardado');
  await dialog.getByRole('button',{name:spanish['projects.create'],exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(api.writes).toHaveLength(1);
  const lab=api.current()?.workspace.laboratory;
  expect(lab).toBeTruthy();
  const {createHash}=await import('node:crypto');
  expect(createHash('sha256').update(lab?.documentJson??'').digest('hex')).toBe(lab?.documentSha256);
  expect(api.writes[0]?.workspace.schemaVersion).toBe(2);
  const document=JSON.parse(lab?.documentJson??'{}') as {state:{activeId:string;selected:number;drafts:Record<string,{sequence:string;protectedPositions:number[]}>}};
  expect(Object.keys(document.state.drafts)).toHaveLength(3);
  expect(document.state.drafts[document.state.activeId].protectedPositions).toEqual([0]);
  await page.getByRole('button',{name:spanish['lab.unprotect'],exact:true}).click();
  await page.getByRole('combobox',{name:spanish['lab.replaceWith']}).selectOption('A');
  await page.getByRole('button',{name:spanish['lab.applyReplacement'],exact:true}).click();
  api.setConflict();
  await page.getByRole('button',{name:spanish['lab.saveProject'],exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:spanish['projects.update'],exact:true}).click();
  await expect(dialog.getByText(spanish['projects.conflict'],{exact:false})).toBeVisible();
  await expect(dialog.getByRole('button',{name:spanish['projects.saveCopy'],exact:true})).toBeEnabled();
  api.clearConflict();
  await dialog.getByRole('button',{name:spanish['projects.saveCopy'],exact:true}).click();
  await expect(dialog).toHaveCount(0);
  // A failed import keeps the current project binding and its drafts.
  await page.locator('input[type=file]').setInputFiles({name:'corrupt.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:spanish['lab.saveProject'],exact:true}).click();
  dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:spanish['projects.update'],exact:true})).toBeVisible();
  // Recovering names what the laboratory loses, not the analysis inputs.
  await dialog.getByRole('button',{name:spanish['projects.reload'],exact:true}).click();
  await expect(dialog.getByText(spanish['lab.reopenWarning'])).toBeVisible();
  await expect(dialog.getByText(spanish['projects.replaceWarning'])).toHaveCount(0);
  await page.keyboard.press('Escape');
  await navigationLink(page,spanish['nav.projects']).click();
  await projectLibrary(page).getByRole('button',{name:spanish['projects.refresh'],exact:true}).click();
  const card=projectLibrary(page).getByRole('article',{name:'Laboratorio guardado'});
  await expect(card.getByRole('button',{name:'Abrir laboratorio de Laboratorio guardado'})).toBeVisible();
  await card.getByRole('button',{name:'Abrir laboratorio de Laboratorio guardado'}).click();
  await expect(page).toHaveURL(new RegExp(ROUTES.laboratory+'$'));
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await expect(page.getByRole('button',{name:spanish['lab.protect'],exact:true})).toBeVisible();
  await expect(page.locator('.lab-table tbody tr').first()).toContainText(spanish['lab.draftState']);
  // Opening the laboratory over unsaved drafts warns about the laboratory, and cancelling keeps them.
  await page.getByRole('button',{name:spanish['lab.protect'],exact:true}).click();
  await navigationLink(page,spanish['nav.projects']).click();
  await projectLibrary(page).getByRole('button',{name:'Abrir laboratorio de Laboratorio guardado'}).click();
  await expect(page.getByRole('dialog').getByText(spanish['lab.reopenWarning'])).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:spanish['projects.cancel'],exact:true}).click();
  await expect(page).toHaveURL(new RegExp(ROUTES.projects+'$'));
  await page.reload();
  await navigationLink(page,spanish['nav.projects']).click();
  await projectLibrary(page).getByRole('button',{name:'Abrir laboratorio de Laboratorio guardado'}).click();
  await expect(page).toHaveURL(new RegExp(ROUTES.laboratory+'$'));
  await expect(page.locator('.lab-table tbody tr').first()).toContainText(spanish['lab.draftState']);
  // Reopening a self-contained cloud document goes through the Worker hash check.
  api.corrupt();
  await navigationLink(page,spanish['nav.projects']).click();
  await projectLibrary(page).getByRole('button',{name:'Abrir laboratorio de Laboratorio guardado'}).click();
  await expect(page).toHaveURL(new RegExp(ROUTES.projects+'$'));
  await expect(projectLibrary(page).getByText(spanish['projects.validation'],{exact:true})).toBeVisible();
});

for(const width of [360,1280])test(`laboratory project form ${String(width)}px supports keyboard, themes and AA`,async({page})=>{
  await mockProjects(page);
  await page.setViewportSize({width,height:900});
  await page.goto(ROUTES.laboratory);
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  const button=page.getByRole('button',{name:spanish['lab.saveProject'],exact:true});
  for(const theme of ['light','dark']){
    await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
    await button.click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel(spanish['projects.name']).fill('Ubiquitina');
    await assertFits(page);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    const targets=await dialog.locator('button,input').evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return{width:r.width,height:r.height};}));
    expect(targets.every(target=>target.width>=44&&target.height>=44)).toBe(true);
    await page.screenshot({path:`artifacts/laboratory-project-${String(width)}-${theme}.png`,fullPage:true});
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();
  }
});

test('laboratory drafts survive internal access routes and offer a file before external sign-in',async({page})=>{
  await page.goto(ROUTES.laboratory);await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await page.getByRole('button',{name:spanish['lab.protect'],exact:true}).click();
  await page.getByRole('button',{name:spanish['lab.saveProject'],exact:true}).click();
  await page.getByRole('dialog').getByRole('link',{name:spanish['shell.signIn'],exact:true}).click();
  await expect(page).toHaveURL(new RegExp(ROUTES.signIn+'$'));
  await expect(page.getByText(spanish['lab.oauthHelp'],{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:spanish['lab.saveFile'],exact:true})).toBeEnabled();
  await page.getByRole('main').getByRole('link',{name:spanish['auth.signUpAction'],exact:true}).click();
  await page.getByRole('main').getByRole('link',{name:spanish['auth.signInAction'],exact:true}).click();
  await navigationLink(page,spanish['nav.generate']).click();
  await page.getByRole('link',{name:spanish['lab.openLaboratory'],exact:true}).click();
  await expect(page.getByRole('button',{name:spanish['lab.unprotect'],exact:true})).toBeVisible();
});
