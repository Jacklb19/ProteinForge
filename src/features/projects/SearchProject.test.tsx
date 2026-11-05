import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';
import type { Project, ProjectWrite } from './contracts';
import type { ProjectApi } from './projectApi';
import { generatorHistoryRuns } from '../generator/history';
import { defaultExport } from '../../test/generatorHistoryFixture';

const open: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Insulina', activeSequence: 'ACD', status: 'draft', createdAt: '2026-10-27T08:00:00.123456Z', updatedAt: '2026-10-27T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
const other: Project = { ...open, id: '00000000-0000-4000-8000-000000000011', name: 'Lisozima', activeSequence: 'KVF' };
const created = '00000000-0000-4000-8000-000000000012';

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); localStorage.setItem(`proteinforge:last-project:${signedInFixture.session?.user.id ?? ''}`, open.id); });

function api(): ProjectApi {
  return {
    list: vi.fn().mockResolvedValue({ items: [], nextPageToken: null }),
    open: vi.fn().mockImplementation((id: string) => Promise.resolve(id === other.id ? other : open)),
    save: vi.fn().mockImplementation((write: ProjectWrite, _token: string, base?: Project) => Promise.resolve({ ...(base ?? { ...open, id: created }), ...write, updatedAt: '2026-10-27T08:00:01.123456Z' })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}
function Harness() {
  const projects = useProjects();
  const draft = useSequenceDraft();
  const destination = projects.searchProject;
  return <>
    <output data-testid="state">{JSON.stringify({ active: projects.active?.id, search: destination?.id ?? null, runs: destination?.workspace.generatorHistory ? generatorHistoryRuns(destination.workspace.generatorHistory).length : 0, text: draft.text, busy: projects.busy })}</output>
    <button type="button" onClick={() => { void projects.chooseSearchProject(other.id); }}>other</button>
    <button type="button" onClick={() => { void projects.chooseSearchProject(null); }}>none</button>
    <button type="button" onClick={() => { void projects.createSearchProject('  Péptidos  '); }}>create</button>
    <button type="button" onClick={() => { void projects.saveGeneratorRun(defaultExport, null, destination ? { kind: 'project', id: destination.id } : { kind: 'active' }); }}>save</button>
  </>;
}
function mount(service: ProjectApi) {
  render(<AuthContext.Provider value={signedInFixture}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={service}><Harness /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>);
}
const state = () => JSON.parse(screen.getByTestId('state').textContent) as { active?: string; search: string | null; runs: number; text: string; busy: boolean };
async function click(name: string) { fireEvent.click(screen.getByRole('button', { name })); await waitFor(() => { expect(state().busy).toBe(false); }); }

it('follows the project open in Analyze until another is chosen, without opening that one in Analyze', async () => {
  const service = api(); mount(service);
  await waitFor(() => { expect(state()).toMatchObject({ active: open.id, search: open.id }); });
  const text = state().text;
  await click('other');
  expect(state()).toMatchObject({ active: open.id, search: other.id, text });
  await click('save');
  // The search goes to the chosen project, read fresh, with its own sequence untouched.
  expect(vi.mocked(service.save).mock.lastCall?.[0]).toMatchObject({ name: other.name, activeSequence: other.activeSequence });
  expect(state().runs).toBe(1);
  await click('none');
  expect(state()).toMatchObject({ active: open.id, search: null });
});

it('creates an empty project for searches and makes it the destination', async () => {
  const service = api(); mount(service);
  await waitFor(() => { expect(state().search).toBe(open.id); });
  await click('create');
  expect(vi.mocked(service.save).mock.lastCall?.[0]).toMatchObject({ name: 'Péptidos', activeSequence: '' });
  expect(vi.mocked(service.save).mock.lastCall?.[2]).toBeUndefined();
  expect(state()).toMatchObject({ active: open.id, search: created });
});
