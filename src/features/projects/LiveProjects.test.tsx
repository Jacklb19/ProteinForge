import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';
import type { ProjectApi } from './projectApi';
import type { Project } from './contracts';
import type { LiveChange, LiveChannel, LiveConnector } from '../live/liveChannel';
import { signedInFixture } from '../../test/authFixture';

const project: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Study', activeSequence: 'ACD', status: 'draft', createdAt: '2026-11-02T08:00:00.123456Z', updatedAt: '2026-11-02T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
const elsewhere: Project = { ...project, id: '00000000-0000-4000-8000-000000000011', name: 'From another device', updatedAt: '2026-11-02T09:00:00.5Z' };

function Probe(): React.JSX.Element {
  const projects = useProjects();
  return <>
    <output data-testid="names">{projects.items.map(item => item.name).join('|')}</output>
    <output data-testid="busy">{String(projects.busy)}</output>
    <output data-testid="notice">{projects.notice ?? ''}</output>
    <output data-testid="remote">{projects.remoteChange ?? ''}</output>
    <button onClick={() => { void projects.open(project.id); }}>open</button>
    <button onClick={() => { void projects.save('Study'); }}>save</button>
  </>;
}
function setup(api: ProjectApi) {
  let notify: (change: LiveChange) => void = () => undefined;
  const setToken = vi.fn<LiveChannel['setToken']>(), close = vi.fn<LiveChannel['close']>();
  const channel: LiveChannel = { setToken, setActive: vi.fn<LiveChannel['setActive']>(), close };
  const live = vi.fn<LiveConnector>(({ onChange }) => { notify = onChange; return channel; });
  const tree = (value: AuthContextValue): React.JSX.Element => <AuthContext.Provider value={value}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={api} live={live}><Probe /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>;
  const view = render(tree(signedInFixture));
  return { setToken, close, live, notify: (change: LiveChange) => { act(() => { notify(change); }); }, rerender: (value: AuthContextValue) => { view.rerender(tree(value)); } };
}
const service = (): ProjectApi => ({ list: vi.fn().mockResolvedValue({ items: [project], nextPageToken: null }), open: vi.fn().mockResolvedValue(project), save: vi.fn().mockResolvedValue(project), remove: vi.fn().mockResolvedValue(undefined) });
const listed = async (): Promise<void> => { await waitFor(() => { expect(screen.getByTestId('names')).toHaveTextContent('Study'); expect(screen.getByTestId('busy')).toHaveTextContent('false'); }); };

describe('live project list', () => {
  it('lists again, quietly, when the account changes elsewhere', async () => {
    const api = service();
    const { notify } = setup(api);
    await listed();
    vi.mocked(api.list).mockResolvedValue({ items: [elsewhere, project], nextPageToken: null });
    notify({ changed: [{ id: elsewhere.id, updatedAt: '2026-11-02T09:00:00.500000+00:00' }], removed: [] });
    await waitFor(() => { expect(screen.getByTestId('names')).toHaveTextContent('From another device|Study'); });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.list).mock.calls[1]?.[0]).toBe('owner-token');
    // Nothing the person did: no busy state, no confirmation.
    expect(screen.getByTestId('busy')).toHaveTextContent('false');
    expect(screen.getByTestId('notice')).toHaveTextContent('');
  });

  it('asks for nothing when the notice repeats what this tab already shows', async () => {
    const api = service();
    const { notify } = setup(api);
    await listed();
    notify({ changed: [{ id: project.id, updatedAt: '2026-11-02T08:00:00.123456+00:00' }], removed: [] });
    await act(async () => { await Promise.resolve(); });
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('keeps the list it has when the quiet request fails', async () => {
    const api = service();
    const { notify } = setup(api);
    await listed();
    vi.mocked(api.list).mockRejectedValue(new Error('offline'));
    notify({ changed: null, removed: [] });
    await waitFor(() => { expect(api.list).toHaveBeenCalledTimes(2); });
    expect(screen.getByTestId('names')).toHaveTextContent('Study');
  });

  it('waits for a save in progress and then compares with its result', async () => {
    const api = service();
    let finish: (value: Project) => void = () => undefined;
    vi.mocked(api.save).mockReturnValue(new Promise<Project>((resolve) => { finish = resolve; }));
    const { notify } = setup(api);
    await listed();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(api.save).toHaveBeenCalled(); });
    const saved = { ...project, updatedAt: '2026-11-02T10:00:00.25Z' };
    vi.mocked(api.list).mockResolvedValue({ items: [saved], nextPageToken: null });
    notify({ changed: [{ id: project.id, updatedAt: '2026-11-02T10:00:00.250000+00:00' }], removed: [] });
    expect(api.list).toHaveBeenCalledTimes(1);
    await act(async () => { finish(saved); await Promise.resolve(); });
    await waitFor(() => { expect(screen.getByTestId('notice')).toHaveTextContent('saved'); expect(screen.getByTestId('busy')).toHaveTextContent('false'); });
    // The save lists once itself; its own echo adds no further request.
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('says when the open project was saved or deleted elsewhere, until this tab holds that version', async () => {
    const api = service();
    const { notify } = setup(api);
    await listed();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => { expect(screen.getByTestId('notice')).toHaveTextContent('opened'); });
    // Its own version, in PostgreSQL's notation: nothing to say.
    notify({ changed: [{ id: project.id, updatedAt: '2026-11-02T08:00:00.123456+00:00' }], removed: [] });
    expect(screen.getByTestId('remote')).toHaveTextContent('');
    const newer = { ...project, updatedAt: '2026-11-02T11:00:00.5Z' };
    vi.mocked(api.list).mockResolvedValue({ items: [newer], nextPageToken: null });
    notify({ changed: [{ id: project.id, updatedAt: '2026-11-02T11:00:00.500000+00:00' }], removed: [] });
    await waitFor(() => { expect(screen.getByTestId('remote')).toHaveTextContent('changed'); });
    vi.mocked(api.open).mockResolvedValue(newer);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => { expect(screen.getByTestId('remote')).toHaveTextContent(''); });
    notify({ changed: [], removed: [project.id] });
    await waitFor(() => { expect(screen.getByTestId('remote')).toHaveTextContent('removed'); });
  });

  it('follows the session: token on sign-in and refresh, closed on sign-out', async () => {
    const api = service();
    const { setToken, close, live, rerender } = setup(api);
    await listed();
    expect(live).toHaveBeenCalledTimes(1);
    expect(setToken).toHaveBeenLastCalledWith('owner-token');
    const session = signedInFixture.session;
    if (!session) throw new Error('Fixture without session');
    rerender({ ...signedInFixture, session: { ...session, accessToken: 'refreshed-token' } });
    expect(setToken).toHaveBeenLastCalledWith('refreshed-token');
    expect(live).toHaveBeenCalledTimes(1);
    rerender({ ...signedInFixture, status: 'anonymous', session: null });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('opens no channel unless one is configured', async () => {
    const api = service();
    render(<AuthContext.Provider value={signedInFixture}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={api}><Probe /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>);
    await listed();
    expect(api.list).toHaveBeenCalledTimes(1);
  });
});
