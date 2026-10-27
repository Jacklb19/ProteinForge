import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';
import type { GeneratorRunTarget } from './projectContext';
import type { Project, ProjectWrite } from './contracts';
import type { ProjectApi } from './projectApi';
import { generatorHistoryRuns } from '../generator/history';
import type { GeneratorHistorySnapshot } from '../generator/history';
import { DEFAULT_EXPORT_SHA256, MAXIMUM_EXPORT_SHA256, defaultExport, exportWithSeed, historyFixture, maximumExport } from '../../test/generatorHistoryFixture';

const LABORATORY = { schemaVersion: 1 as const, documentJson: '{"kind":"proteinforge-laboratory"}', documentSha256: 'a'.repeat(64) };
const base: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Insulina', activeSequence: 'ACD', status: 'draft', createdAt: '2026-10-27T08:00:00.123456Z', updatedAt: '2026-10-27T08:00:00.123456Z', workspace: { schemaVersion: 2, profileWindow: 9, descriptors: null, laboratory: LABORATORY, alignment: { first: 'ACD', second: 'ACE', matrix: 'BLOSUM62', mode: 'global', result: null } } };
const other: Project = { ...base, id: '00000000-0000-4000-8000-000000000011', name: 'Otra', workspace: { ...base.workspace, schemaVersion: 1, laboratory: null } };
let full: GeneratorHistorySnapshot;
let stored: Project;
let outcome: unknown;
beforeAll(async () => { full = await historyFixture(Array.from({ length: 10 }, (_, index) => exportWithSeed(index + 1))); });
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); stored = base; outcome = undefined; localStorage.setItem(`proteinforge:last-project:${signedInFixture.session?.user.id ?? ''}`, base.id); });

function api(): ProjectApi {
  return {
    list: vi.fn().mockResolvedValue({ items: [], nextPageToken: null }),
    open: vi.fn().mockImplementation((id: string) => Promise.resolve(id === other.id ? other : stored)),
    save: vi.fn().mockImplementation((write: ProjectWrite, _token: string, active?: Project) => Promise.resolve({ ...(active ?? { ...base, id: '00000000-0000-4000-8000-000000000012' }), ...write, updatedAt: '2026-10-27T08:00:01.123456Z' })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}
function Harness({ text, target }: { text: string; target: GeneratorRunTarget }) {
  const projects = useProjects();
  return <>
    <output data-testid="state">{JSON.stringify({ active: projects.active?.id, runs: projects.active?.workspace.generatorHistory ? generatorHistoryRuns(projects.active.workspace.generatorHistory).length : 0, error: projects.error?.code, busy: projects.busy })}</output>
    <button type="button" onClick={() => { void projects.saveGeneratorRun(text, { arm: 'guided', index: 0 }, target).then((value) => { outcome = value; }); }}>save</button>
    <button type="button" onClick={() => { void projects.removeGeneratorRun(DEFAULT_EXPORT_SHA256); }}>remove</button>
  </>;
}
function mount(service: ProjectApi, text = defaultExport, target: GeneratorRunTarget = { kind: 'active' }) {
  render(<AuthContext.Provider value={signedInFixture}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={service}><Harness text={text} target={target} /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>);
}
const state = () => JSON.parse(screen.getByTestId('state').textContent) as { active?: string; runs: number; error?: string; busy: boolean };
async function ready() { await waitFor(() => { expect(state().busy).toBe(false); }); }
async function click(name: string) { fireEvent.click(screen.getByRole('button', { name })); await ready(); }
const lastWrite = (service: ProjectApi) => vi.mocked(service.save).mock.lastCall?.[0];

it('adds the exact export to the open project, keeping its stored analysis and laboratory, as version 3', async () => {
  const service = api(); mount(service); await ready();
  await waitFor(() => { expect(state().active).toBe(base.id); });
  await click('save');
  const write = lastWrite(service);
  expect(write).toMatchObject({ name: base.name, activeSequence: base.activeSequence, workspace: { schemaVersion: 3, laboratory: LABORATORY, alignment: base.workspace.alignment } });
  const runs = write?.workspace.generatorHistory ? generatorHistoryRuns(write.workspace.generatorHistory) : [];
  expect(runs.map((run) => [run.id, run.resultJson === defaultExport, run.selection, run.appBuild])).toEqual([[DEFAULT_EXPORT_SHA256, true, { arm: 'guided', index: 0 }, null]]);
  expect(vi.mocked(service.save).mock.lastCall?.[2]).toMatchObject({ id: base.id, updatedAt: base.updatedAt });
  expect(state()).toMatchObject({ active: base.id, runs: 1 });
  expect(outcome).toEqual({ project: base.name, added: true });
});

it('keeps an identical search once and removes it without lowering the version', async () => {
  stored = { ...base, workspace: { ...base.workspace, schemaVersion: 3, generatorHistory: await historyFixture([defaultExport, maximumExport]) } };
  const service = api(); mount(service); await ready();
  await waitFor(() => { expect(state().runs).toBe(2); });
  await click('save');
  expect(service.save).not.toHaveBeenCalled();
  expect(outcome).toEqual({ project: base.name, added: false });
  await click('remove');
  const write = lastWrite(service);
  expect(write?.workspace.schemaVersion).toBe(3);
  expect(write?.workspace.laboratory).toEqual(LABORATORY);
  expect(write?.workspace.generatorHistory && generatorHistoryRuns(write.workspace.generatorHistory).map((run) => run.id)).toEqual([MAXIMUM_EXPORT_SHA256]);
});

it('refuses an eleventh search before any request and never drops a saved one', async () => {
  stored = { ...base, workspace: { ...base.workspace, schemaVersion: 3, generatorHistory: full } };
  const service = api(); mount(service, exportWithSeed(99)); await ready();
  await waitFor(() => { expect(state().runs).toBe(10); });
  await click('save');
  expect(state().error).toBe('generator-history-size');
  expect(service.save).not.toHaveBeenCalled();
  expect(state().runs).toBe(10);
  expect(outcome).toBeNull();
});

it('saves to another stored project without changing the one open in Analyze', async () => {
  const service = api(); mount(service, defaultExport, { kind: 'project', id: other.id }); await ready();
  await click('save');
  expect(service.open).toHaveBeenCalledWith(other.id, 'owner-token', expect.any(AbortSignal));
  expect(lastWrite(service)).toMatchObject({ name: other.name, workspace: { schemaVersion: 3, alignment: other.workspace.alignment } });
  expect(vi.mocked(service.save).mock.lastCall?.[2]).toMatchObject({ id: other.id });
  expect(state()).toMatchObject({ active: base.id, runs: 0 });
});

it('creates a new project that holds only the search', async () => {
  const service = api(); mount(service, defaultExport, { kind: 'new', name: '  Búsquedas  ' }); await ready();
  await click('save');
  expect(lastWrite(service)).toMatchObject({ name: 'Búsquedas', activeSequence: '', workspace: { schemaVersion: 3, descriptors: null, alignment: { first: '', second: '' } } });
  expect(vi.mocked(service.save).mock.lastCall?.[2]).toBeUndefined();
  expect(outcome).toMatchObject({ added: true });
});
