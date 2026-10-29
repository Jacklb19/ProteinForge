import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';
import type { ProjectApi } from './projectApi';
import type { Project } from './contracts';
import { PROJECT_POINTER_PREFIX } from './config';
import { ApiError } from '../api/apiClient';
import { signedInFixture } from '../../test/authFixture';

const project: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Study', activeSequence: 'ACD', status: 'draft', createdAt: '2026-10-12T08:00:00.123456Z', updatedAt: '2026-10-12T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 19, descriptors: null, alignment: { first: 'ACD', second: 'ACE', matrix: 'BLOSUM80', mode: 'local', result: null } } };
const auth: AuthContextValue = signedInFixture;
function service(): ProjectApi { return { list: vi.fn().mockResolvedValue({ items: [project], nextPageToken: null }), open: vi.fn().mockResolvedValue(project), save: vi.fn().mockResolvedValue(project), remove: vi.fn().mockResolvedValue(undefined) }; }
function Probe() {
  const projects = useProjects(); const sequence = useSequenceDraft(); const alignment = useAlignmentDraft();
  return <><input aria-label="sequence" value={sequence.text} onChange={(event) => { sequence.setText(event.target.value); }} /><output data-testid="state">{JSON.stringify({ active: projects.active?.id, error: projects.error?.code, dirty: projects.dirty, busy: projects.busy, window: sequence.profileWindow, matrix: alignment.matrix })}</output><button onClick={() => { sequence.setProfileWindow(19); }}>profile window</button><button onClick={() => { alignment.update({ matrix: 'BLOSUM45' }); }}>comparison</button><button disabled={projects.busy} onClick={() => { void projects.open(project.id); }}>open</button><button disabled={projects.busy} onClick={() => { void projects.save('Study'); }}>save</button><button disabled={projects.busy} onClick={() => { void projects.duplicate(project, 'Copy'); }}>duplicate</button><button disabled={projects.busy} onClick={() => { void projects.refresh(false, { query: ' Study ', order: 'name' }); }}>search</button><button disabled={projects.busy} onClick={() => { void projects.refresh(true); }}>more</button></>;
}
function Harness({ api, initialIdentity = auth }: { api: ProjectApi; initialIdentity?: AuthContextValue }) {
  const [identity, setIdentity] = useState(initialIdentity);
  return <AuthContext.Provider value={identity}><button onClick={() => { setIdentity(auth); }}>sign in</button><button onClick={() => { setIdentity({ ...auth, status: 'anonymous', session: null }); }}>sign out</button><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={api}><Probe /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>;
}
beforeEach(() => { localStorage.clear(); });
describe('project lifecycle', () => {
  it.each(['profile window', 'comparison'])('keeps parameters chosen before sign-in: %s', async (parameter) => {
    localStorage.setItem(`${PROJECT_POINTER_PREFIX}owner`, project.id);
    const api = service();
    render(<Harness api={api} initialIdentity={{ ...auth, status: 'anonymous', session: null }} />);
    fireEvent.click(screen.getByRole('button', { name: parameter }));
    fireEvent.click(screen.getByRole('button', { name: 'sign in' }));
    await waitFor(() => { expect(api.list).toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'open' })).toBeEnabled(); });
    expect(api.open).not.toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent(parameter === 'profile window' ? '"window":19' : '"matrix":"BLOSUM45"');
  });
  it.each(['profile window', 'comparison'])('preserves parameter edits during a manual open: %s', async (parameter) => {
    const api = service(); let resolve!: (value: Project) => void;
    api.open = vi.fn().mockReturnValueOnce(new Promise<Project>((done) => { resolve = done; }));
    render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByRole('button', { name: 'open' })).toBeEnabled(); });
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.click(screen.getByRole('button', { name: parameter }));
    await act(async () => { resolve(project); await Promise.resolve(); });
    expect(screen.getByTestId('state')).toHaveTextContent('"error":"draft-changed"');
    expect(screen.getByTestId('state')).toHaveTextContent(parameter === 'profile window' ? '"window":19' : '"matrix":"BLOSUM45"');
    expect(screen.getByLabelText('sequence')).toHaveValue('');
  });
  it('does not resume over edits made while the collection is loading', async () => {
    localStorage.setItem(`${PROJECT_POINTER_PREFIX}owner`, project.id);
    const api = service(); let resolve!: (value: Awaited<ReturnType<ProjectApi['list']>>) => void;
    api.list = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<Harness api={api} />);
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    await act(async () => { resolve({ items: [project], nextPageToken: null }); await Promise.resolve(); });
    expect(screen.getByLabelText('sequence')).toHaveValue('MKWV');
    expect(api.open).not.toHaveBeenCalled();
    expect(screen.getByTestId('state')).not.toHaveTextContent(`"active":"${project.id}"`);
    expect(screen.getByRole('button', { name: 'open' })).toBeEnabled();
  });
  it('does not resume over edits made while the saved project is loading', async () => {
    localStorage.setItem(`${PROJECT_POINTER_PREFIX}owner`, project.id);
    const api = service(); let resolve!: (value: Project) => void;
    api.open = vi.fn().mockReturnValue(new Promise<Project>((done) => { resolve = done; }));
    render(<Harness api={api} />);
    await waitFor(() => { expect(api.open).toHaveBeenCalled(); });
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    await act(async () => { resolve(project); await Promise.resolve(); });
    expect(screen.getByLabelText('sequence')).toHaveValue('MKWV');
    expect(screen.getByTestId('state')).not.toHaveTextContent(`"active":"${project.id}"`);
    expect(localStorage.getItem(`${PROJECT_POINTER_PREFIX}owner`)).toBe(project.id);
  });
  it('rejects a late manual open after an edit and allows a deliberate retry', async () => {
    const api = service(); let resolve!: (value: Project) => void;
    api.open = vi.fn().mockReturnValueOnce(new Promise<Project>((done) => { resolve = done; })).mockResolvedValue(project);
    render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByRole('button', { name: 'open' })).toBeEnabled(); });
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'ACD' } });
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    // Even a formatting-only edit must survive an old response.
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'acd ' } });
    await act(async () => { resolve(project); await Promise.resolve(); });
    expect(screen.getByLabelText('sequence')).toHaveValue('acd ');
    expect(screen.getByTestId('state')).toHaveTextContent('"error":"draft-changed"');
    expect(localStorage.getItem(`${PROJECT_POINTER_PREFIX}owner`)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => { expect(screen.getByLabelText('sequence')).toHaveValue('ACD'); });
    expect(screen.getByTestId('state')).not.toHaveTextContent('"error"');
  });
  it('duplicates the saved snapshot without replacing an edited draft, active revision or pointer', async () => {
    const user = userEvent.setup(); const api = service();
    localStorage.setItem(`${PROJECT_POINTER_PREFIX}owner`, project.id);
    api.save = vi.fn().mockResolvedValue({ ...project, id: '00000000-0000-4000-8000-000000000011', name: 'Copy' });
    render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByLabelText('sequence')).toHaveValue('ACD'); });
    await user.type(screen.getByLabelText('sequence'), 'E');
    await user.click(screen.getByRole('button', { name: 'duplicate' }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'duplicate' })).toBeEnabled(); });
    expect(api.save).toHaveBeenCalledWith({ name: 'Copy', activeSequence: 'ACD', workspace: project.workspace }, 'owner-token', undefined, expect.any(AbortSignal));
    expect(screen.getByLabelText('sequence')).toHaveValue('ACDE');
    expect(screen.getByTestId('state')).toHaveTextContent(`"active":"${project.id}"`);
    expect(screen.getByTestId('state')).toHaveTextContent('"dirty":true');
    expect(localStorage.getItem(`${PROJECT_POINTER_PREFIX}owner`)).toBe(project.id);
  });
  it('keeps the global query and order when fetching another page', async () => {
    const user = userEvent.setup(); const api = service();
    api.list = vi.fn().mockResolvedValue({ items: [project], nextPageToken: 'scoped-next' });
    render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByRole('button', { name: 'search' })).toBeEnabled(); });
    await user.click(screen.getByRole('button', { name: 'search' }));
    await waitFor(() => { expect(api.list).toHaveBeenCalledWith('owner-token', '', expect.any(AbortSignal), { query: 'Study', order: 'name' }); });
    await user.click(screen.getByRole('button', { name: 'more' }));
    await waitFor(() => { expect(api.list).toHaveBeenCalledWith('owner-token', 'scoped-next', expect.any(AbortSignal), { query: 'Study', order: 'name' }); });
  });
  it('restores the pointer from the server after reload with the current owner token', async () => {
    localStorage.setItem(`${PROJECT_POINTER_PREFIX}owner`, project.id);
    const api = service(); render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByLabelText('sequence')).toHaveValue('ACD'); });
    expect(api.open).toHaveBeenCalledWith(project.id, 'owner-token', expect.any(AbortSignal));
    expect(screen.getByTestId('state')).toHaveTextContent('"window":19');
    expect(screen.getByTestId('state')).toHaveTextContent('"matrix":"BLOSUM80"');
    expect(localStorage.getItem(`${PROJECT_POINTER_PREFIX}owner`)).toBe(project.id);
    expect(Object.values(localStorage).join()).not.toContain('ACD');
  });
  it('keeps edits made during a save and leaves the newer inputs unsaved', async () => {
    const user = userEvent.setup(); const api = service(); let resolve!: (value: Project) => void;
    api.save = vi.fn().mockReturnValue(new Promise<Project>((done) => { resolve = done; }));
    render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByRole('button', { name: 'open' })).toBeEnabled(); });
    await user.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => { expect(screen.getByLabelText('sequence')).toHaveValue('ACD'); });
    await user.click(screen.getByRole('button', { name: 'save' }));
    await user.type(screen.getByLabelText('sequence'), 'E');
    await act(async () => { resolve({ ...project, updatedAt: '2026-10-12T08:00:01.123456Z' }); await Promise.resolve(); });
    expect(screen.getByLabelText('sequence')).toHaveValue('ACDE');
    expect(screen.getByTestId('state')).toHaveTextContent('"dirty":true');
  });
  it('keeps the old revision and draft after 409 rather than silently overwriting', async () => {
    const user = userEvent.setup(); const api = service(); api.save = vi.fn().mockRejectedValue(new ApiError('conflict'));
    localStorage.setItem(`${PROJECT_POINTER_PREFIX}owner`, project.id); render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByLabelText('sequence')).toHaveValue('ACD'); });
    await user.type(screen.getByLabelText('sequence'), 'E'); await user.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(screen.getByTestId('state')).toHaveTextContent('"error":"conflict"'); });
    expect(screen.getByLabelText('sequence')).toHaveValue('ACDE');
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ activeSequence: 'ACDE' }), 'owner-token', project, expect.any(AbortSignal));
  });
  it('cancels an in-flight open when the account changes and ignores a late response', async () => {
    const user = userEvent.setup(); const api = service(); let resolve!: (value: Project) => void;
    api.open = vi.fn().mockReturnValue(new Promise<Project>((done) => { resolve = done; })); render(<Harness api={api} />);
    await waitFor(() => { expect(screen.getByRole('button', { name: 'open' })).toBeEnabled(); });
    await user.click(screen.getByRole('button', { name: 'open' })); await user.click(screen.getByRole('button', { name: 'sign out' }));
    await act(async () => { resolve(project); await Promise.resolve(); });
    expect(screen.getByLabelText('sequence')).toHaveValue('');
    expect(screen.getByTestId('state')).not.toHaveTextContent(project.id);
    expect(localStorage.getItem(`${PROJECT_POINTER_PREFIX}owner`)).toBeNull();
  });
});
