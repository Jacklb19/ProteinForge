import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { ApiError } from '../api/errors';
import { ProjectContext } from '../projects/projectContext';
import type { ProjectContextValue } from '../projects/projectContext';
import type { Project } from '../projects/contracts';
import { DEFAULT_PROJECT_QUERY } from '../projects/config';
import { translate } from '../../i18n/translate';
import { GeneratorContext, INITIAL_SEARCH_FORM } from './context';
import type { GeneratorState } from './context';
import { SavedRuns } from './GeneratorHistory';
import { useGeneratorSave } from './useGeneratorSave';
import { useSearchProjectPicker } from './SearchProjectPicker';
import { readGeneratorHistoryEnabled } from './historyFeature';
import type { SearchResult } from './search';
import { DEFAULT_EXPORT_SHA256, defaultExport, historyFixture, maximumExport } from '../../test/generatorHistoryFixture';

const t = (key: Parameters<typeof translate>[1], variables?: Parameters<typeof translate>[2]) => translate('es', key, variables);
const result = JSON.parse(defaultExport) as SearchResult;
const anonymous = { ...signedInFixture, status: 'anonymous', session: null } as AuthContextValue;
let active: Project;
beforeAll(async () => {
  active = { id: '00000000-0000-4000-8000-000000000010', name: 'Insulina', activeSequence: 'ACD', status: 'draft', createdAt: '2026-10-27T08:00:00Z', updatedAt: '2026-10-27T08:00:00.123456Z',
    workspace: { schemaVersion: 3, profileWindow: 9, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null }, generatorHistory: await historyFixture([defaultExport, maximumExport]) } };
});
beforeEach(() => { vi.stubEnv('VITE_GENERATOR_HISTORY', 'enabled'); });
afterEach(() => { vi.unstubAllEnvs(); });

function projects(changes: Partial<ProjectContextValue> = {}): ProjectContextValue {
  return { enabled: true, active, laboratory: null, items: [], nextPageToken: null, dirty: false, busy: false, error: null, notice: null, attempt: 0, listing: DEFAULT_PROJECT_QUERY,
    refresh: vi.fn(), open: vi.fn(), saveLaboratory: vi.fn(), save: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn(), detach: vi.fn(),
    remoteChange: null, versions: vi.fn(), restoreVersion: vi.fn(), connection: 'online', pending: [], syncing: false, queuedAnalysis: null, queuedLaboratory: null, retry: vi.fn(), discard: vi.fn(), discardAll: vi.fn(), clearSaved: vi.fn(), resolve: vi.fn(),
    saveGeneratorRun: vi.fn().mockResolvedValue({ project: 'Insulina', added: true }), removeGeneratorRun: vi.fn().mockResolvedValue(true),
    searchProject: changes.active === undefined ? active : changes.active, chooseSearchProject: vi.fn().mockResolvedValue(true), createSearchProject: vi.fn().mockResolvedValue(true), ...changes };
}
const generator: GeneratorState = { form: INITIAL_SEARCH_FORM, setForm: vi.fn(), result, progress: null, status: 'done', run: vi.fn(), cancel: vi.fn(), restore: vi.fn() };
function Actions() { const save = useGeneratorSave(result, false); return <>{save.button}{save.details}</>; }
function Picker() { const picker = useSearchProjectPicker(); return <>{picker.note}{picker.field}{picker.panel}</>; }
function mount(value: ProjectContextValue, auth: AuthContextValue = signedInFixture) {
  return render(<MemoryRouter><AuthContext.Provider value={auth}><ProjectContext.Provider value={value}><GeneratorContext.Provider value={generator}><Actions /><SavedRuns /></GeneratorContext.Provider></ProjectContext.Provider></AuthContext.Provider></MemoryRouter>);
}

describe('generator history interface', () => {
  it('stays off unless the build enables it, so production never offers a save its API refuses', () => {
    vi.stubEnv('VITE_GENERATOR_HISTORY', '');
    expect(readGeneratorHistoryEnabled()).toBe(false);
    mount(projects());
    expect(screen.queryByRole('button', { name: t('generator.saveToProject') })).toBeNull();
    expect(screen.queryByRole('heading', { name: t('generator.historyIn', { project: 'Insulina' }) })).toBeNull();
  });

  it('invites to sign in without offering the save or the list', () => {
    mount(projects(), anonymous);
    expect(screen.getByText(t('generator.signedOutNote'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('shell.signIn') })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('button', { name: t('generator.saveToProject') })).toBeNull();
    expect(screen.queryByRole('heading', { name: t('generator.historyIn', { project: 'Insulina' }) })).toBeNull();
  });

  it('lists the saved searches with their versions and reopens one without searching', () => {
    mount(projects());
    const runs = screen.getAllByRole('article');
    expect(runs).toHaveLength(2);
    expect(within(runs[0] as HTMLElement).getByRole('heading', { name: t('generator.runTitle', { seed: 42, length: 40 }) })).toBeInTheDocument();
    expect(within(runs[1] as HTMLElement).getByText(t('generator.chosenPrefix', { shown: 60, length: '300' }), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('generator.historyIn', { project: 'Insulina' }) })).toBeInTheDocument();
    fireEvent.click(within(runs[0] as HTMLElement).getByRole('button', { name: t('generator.openRun') }));
    expect(generator.restore).toHaveBeenCalledWith(JSON.parse(defaultExport));
  });

  it('confirms before removing, with the focus on keeping it', () => {
    const removeGeneratorRun = vi.fn().mockResolvedValue(true);
    mount(projects({ removeGeneratorRun }));
    const first = screen.getAllByRole('article')[0] as HTMLElement;
    fireEvent.click(within(first).getByRole('button', { name: t('generator.removeRun') }));
    expect(within(first).getByRole('button', { name: t('generator.removeKeep') })).toHaveFocus();
    fireEvent.click(within(first).getByRole('button', { name: t('generator.removeConfirm') }));
    expect(removeGeneratorRun).toHaveBeenCalledWith(DEFAULT_EXPORT_SHA256);
  });

  it('saves the exact export with the chosen candidate to Design\'s project, the one open in Analyze by default', async () => {
    const saveGeneratorRun = vi.fn().mockResolvedValue({ project: 'Insulina', added: true });
    mount(projects({ saveGeneratorRun }));
    expect(screen.getByText(t('generator.savesTo', { project: 'Insulina' }), { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('generator.saveToProject') }));
    const dialog = screen.getByRole('dialog', { name: t('generator.saveTitle') });
    expect(within(dialog).getByRole('button', { name: t('generator.saveCancel') })).toHaveFocus();
    fireEvent.change(within(dialog).getByLabelText(t('generator.chosen')), { target: { value: 'reference:1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: t('generator.save') }));
    await vi.waitFor(() => { expect(saveGeneratorRun).toHaveBeenCalledWith(defaultExport, { arm: 'reference', index: 1 }, { kind: 'active' }); });
  });

  it('gives each refusal its next step and keeps other failures plain', () => {
    const size = projects({ attempt: 0, error: new ApiError('generator-history-size') });
    const view = mount(size);
    // Feedback belongs to this screen's own attempt; an older failure elsewhere is not shown.
    expect(screen.queryByText(t('generator.fullChoose'))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('generator.saveToProject') }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('generator.save') }));
    view.rerender(<MemoryRouter><AuthContext.Provider value={signedInFixture}><ProjectContext.Provider value={{ ...size, attempt: 1 }}><GeneratorContext.Provider value={generator}><Actions /><SavedRuns /></GeneratorContext.Provider></ProjectContext.Provider></AuthContext.Provider></MemoryRouter>);
    expect(screen.getByText(t('generator.historySize'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('generator.fullChoose') })).toHaveAttribute('href', '#generator-saved-runs');
    expect(screen.getByRole('button', { name: t('generator.fullDownload') })).toBeInTheDocument();
    view.rerender(<MemoryRouter><AuthContext.Provider value={signedInFixture}><ProjectContext.Provider value={{ ...size, attempt: 1, error: new ApiError('requires-current-client') }}><GeneratorContext.Provider value={generator}><Actions /><SavedRuns /></GeneratorContext.Provider></ProjectContext.Provider></AuthContext.Provider></MemoryRouter>);
    expect(screen.getByText(t('projects.requiresCurrentClient'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('generator.reload') })).toBeInTheDocument();
  });

  it('asks to choose a project above when Design has none, and does not offer the save', () => {
    mount(projects({ active: null, searchProject: null }));
    expect(screen.getByRole('heading', { name: t('generator.historyNone') })).toBeInTheDocument();
    expect(screen.getAllByText(t('generator.chooseAbove'))).toHaveLength(2);
    expect(screen.getByRole('button', { name: t('generator.saveToProject') })).toBeDisabled();
  });

  it('saves to and lists another project chosen in Design without opening it in Analyze', async () => {
    const other: Project = { ...active, id: '00000000-0000-4000-8000-000000000020', name: 'Lisozima' };
    const saveGeneratorRun = vi.fn().mockResolvedValue({ project: 'Lisozima', added: true });
    mount(projects({ searchProject: other, saveGeneratorRun }));
    expect(screen.getByRole('heading', { name: t('generator.historyIn', { project: 'Lisozima' }) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('generator.saveToProject') }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('generator.save') }));
    await vi.waitFor(() => { expect(saveGeneratorRun).toHaveBeenCalledWith(defaultExport, null, { kind: 'project', id: other.id }); });
  });

  it('chooses and creates Design\'s project from the heading', async () => {
    const chooseSearchProject = vi.fn().mockResolvedValue(true);
    const createSearchProject = vi.fn().mockResolvedValue(true);
    const items = [{ id: active.id, name: 'Insulina', status: 'draft', createdAt: active.createdAt, updatedAt: active.updatedAt, preview: null },
      { id: '00000000-0000-4000-8000-000000000020', name: 'Lisozima', status: 'draft', createdAt: active.createdAt, updatedAt: active.updatedAt, preview: null }];
    render(<MemoryRouter><AuthContext.Provider value={signedInFixture}><ProjectContext.Provider value={projects({ items, chooseSearchProject, createSearchProject })}><GeneratorContext.Provider value={generator}><Picker /></GeneratorContext.Provider></ProjectContext.Provider></AuthContext.Provider></MemoryRouter>);
    const picker = screen.getByLabelText(t('generator.project'));
    expect(picker).toHaveValue(active.id);
    expect(screen.getByRole('option', { name: t('generator.projectOption', { name: 'Insulina', count: 2 }) })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t('generator.projectOptionNone', { name: 'Lisozima' }) })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: '00000000-0000-4000-8000-000000000020' } });
    expect(chooseSearchProject).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000020');
    fireEvent.change(picker, { target: { value: 'none' } });
    expect(chooseSearchProject).toHaveBeenLastCalledWith(null);
    fireEvent.change(picker, { target: { value: 'new' } });
    const name = screen.getByLabelText(t('generator.newName'));
    await vi.waitFor(() => { expect(name).toHaveFocus(); });
    fireEvent.change(name, { target: { value: 'Péptidos' } });
    fireEvent.click(screen.getByRole('button', { name: t('generator.createProject') }));
    await vi.waitFor(() => { expect(createSearchProject).toHaveBeenCalledWith('Péptidos'); });
    await vi.waitFor(() => { expect(screen.queryByLabelText(t('generator.newName'))).toBeNull(); });
    expect(picker).toHaveFocus();
  });
});
