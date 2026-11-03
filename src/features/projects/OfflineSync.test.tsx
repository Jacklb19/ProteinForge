import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';
import type { ProjectApi } from './projectApi';
import type { Project } from './contracts';
import { SYNC_RETRY_DELAYS_MS } from './config';
import { ApiError } from '../api/apiClient';
import { signedInFixture } from '../../test/authFixture';
import { defaultExport } from '../../test/generatorHistoryFixture';

const project: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Study', activeSequence: 'ACD', status: 'draft', createdAt: '2026-11-02T08:00:00.123456Z', updatedAt: '2026-11-02T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
const remote: Project = { ...project, activeSequence: 'ACDW', updatedAt: '2026-11-02T08:10:00.123456Z' };
const other: AuthContextValue = { ...signedInFixture, session: { accessToken: 'other-token', refreshToken: 'other-refresh', expiresAt: 9999999999, user: { id: 'other', email: 'b@example.org' } } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let online = true;
function connect(value: boolean): void {
  online = value;
  act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')); });
}
function service(): ProjectApi {
  return { list: vi.fn().mockResolvedValue({ items: [project], nextPageToken: null }), open: vi.fn().mockResolvedValue(project), save: vi.fn().mockImplementation((write: { name: string; activeSequence: string }) => Promise.resolve({ ...project, ...write, updatedAt: '2026-11-02T09:00:00.123456Z' })), remove: vi.fn().mockResolvedValue(undefined) };
}
function Probe() {
  const projects = useProjects(); const sequence = useSequenceDraft();
  const entry = projects.pending.at(0);
  return <>
    <input aria-label="sequence" value={sequence.text} onChange={(event) => { sequence.setText(event.target.value); }} />
    <output data-testid="state">{JSON.stringify({ connection: projects.connection, active: projects.active?.id, items: projects.items.length, error: projects.error?.code, pending: projects.pending.map(item => ({ state: item.state, owner: item.owner, error: item.error, name: item.name })), queued: projects.queuedAnalysis?.state ?? null })}</output>
    <button disabled={projects.busy} onClick={() => { void projects.open(project.id); }}>open</button>
    <button disabled={projects.busy} onClick={() => { void projects.save('Study'); }}>save</button>
    <button onClick={() => { void projects.refresh(false, { query: 'Study', order: 'recent' }); }}>search</button>
    <button disabled={projects.busy} onClick={() => { void projects.saveGeneratorRun(defaultExport, null, { kind: 'active' }); }}>save search</button>
    {entry && <><button onClick={() => { void projects.resolve(entry.key, 'both', 'Study (copia)'); }}>keep both</button><button onClick={() => { void projects.resolve(entry.key, 'mine', 'Study (copia)'); }}>keep mine</button><button onClick={() => { projects.retry(entry.key); }}>retry</button><button onClick={() => { projects.discardAll('others'); }}>discard others</button></>}
  </>;
}
function Harness({ api }: { api: ProjectApi }) {
  const [identity, setIdentity] = useState<AuthContextValue>(signedInFixture);
  return <AuthContext.Provider value={identity}>
    <button onClick={() => { setIdentity(signedInFixture); }}>sign in</button>
    <button onClick={() => { setIdentity(other); }}>sign in other</button>
    <button onClick={() => { setIdentity({ ...signedInFixture, status: 'anonymous', session: null }); }}>session ends</button>
    <SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={api}><Probe /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider>
  </AuthContext.Provider>;
}
const state = (): Record<string, unknown> => JSON.parse(screen.getByTestId('state').textContent) as Record<string, unknown>;
async function ready(api: ProjectApi, open = true): Promise<void> {
  render(<Harness api={api} />);
  await waitFor(() => { expect(screen.getByRole('button', { name: 'save' })).toBeEnabled(); });
  if (!open) return;
  fireEvent.click(screen.getByRole('button', { name: 'open' }));
  await waitFor(() => { expect(state().active).toBe(project.id); });
  fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'ACDE' } });
}
/** Moves the clock past a retry delay and wakes the queue. */
function later(milliseconds: number): void {
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + milliseconds);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

beforeEach(() => {
  localStorage.clear();
  online = true;
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('saving without a connection', () => {
  it('queues the save in this tab, warns before closing it, and sends it when the network returns', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    expect(state().connection).toBe('offline');
    expect(state().error).toBeUndefined();
    expect(api.save).not.toHaveBeenCalled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    connect(true);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ activeSequence: 'ACDE' }), 'owner-token', project, expect.any(AbortSignal));
    expect(state()).toMatchObject({ queued: null, active: project.id });
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('keeps the open list when searching fails offline', async () => {
    const api = service();
    await ready(api, false);
    vi.mocked(api.list).mockRejectedValueOnce(new ApiError('network'));
    fireEvent.click(screen.getByRole('button', { name: 'search' }));
    await waitFor(() => { expect(state()).toMatchObject({ error: 'network', connection: 'offline' }); });
    expect(state().items).toBe(1);
  });

  it('shows a real conflict with the account version and keeps both as a copy', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError('conflict'));
    vi.mocked(api.open).mockResolvedValueOnce(remote);
    connect(true);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'conflict' })]); });
    expect(api.open).toHaveBeenLastCalledWith(project.id, 'owner-token', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: 'keep both' }));
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved', name: 'Study (copia)' })]); });
    expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Study (copia)', activeSequence: 'ACDE' }), 'owner-token', undefined, expect.any(AbortSignal), undefined);
  });

  it('keeps mine over the version read from the account', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError('conflict'));
    vi.mocked(api.open).mockResolvedValueOnce(remote);
    connect(true);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'conflict' })]); });
    fireEvent.click(screen.getByRole('button', { name: 'keep mine' }));
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ activeSequence: 'ACDE' }), 'owner-token', remote, expect.any(AbortSignal));
  });

  it('treats meeting its own write after a lost response as saved, not as a conflict', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError('conflict'));
    vi.mocked(api.open).mockResolvedValueOnce({ ...project, activeSequence: 'ACDE', updatedAt: remote.updatedAt });
    connect(true);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
  });

  it('repeats a create with the same request id when the API supports it', async () => {
    vi.stubEnv('VITE_PROJECT_CREATE_IDEMPOTENCY', 'enabled');
    const api = service();
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError('network'));
    await ready(api, false);
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    expect(api.save).toHaveBeenCalledTimes(1);
    later(SYNC_RETRY_DELAYS_MS[0]);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    const [first, second] = vi.mocked(api.save).mock.calls;
    expect(first?.[2]).toBeUndefined();
    expect(first?.[4]).toMatch(UUID);
    expect(second?.[4]).toBe(first?.[4]);
  });

  it('never repeats on its own a create that may exist without request ids; the person can', async () => {
    const api = service();
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError('network'));
    await ready(api, false);
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    later(SYNC_RETRY_DELAYS_MS[0]);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'failed', error: 'network' })]); });
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.save).mock.calls[0]?.[4]).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it('keeps a save across a session that ended offline, sends it only for the same account', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    fireEvent.click(screen.getByRole('button', { name: 'session ends' }));
    expect(state().pending).toEqual([expect.objectContaining({ state: 'pending', owner: 'owner' })]);
    connect(true);
    fireEvent.click(screen.getByRole('button', { name: 'sign in other' }));
    await waitFor(() => { expect(api.list).toHaveBeenCalledWith('other-token', '', expect.any(AbortSignal)); });
    expect(api.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'sign in' }));
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ activeSequence: 'ACDE' }), 'owner-token', project, expect.any(AbortSignal));
  });

  it('lets another account discard what it cannot send', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    fireEvent.click(screen.getByRole('button', { name: 'sign in other' }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'discard others' })).toBeEnabled(); });
    fireEvent.click(screen.getByRole('button', { name: 'discard others' }));
    expect(state().pending).toEqual([]);
  });
});

describe('review fixes', () => {
  it('saves the analysis of a project with a waiting search as an update of that project, never a new one', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save search' }));
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'pending' })]); });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    expect(state().pending).toHaveLength(1);
    connect(true);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    expect(api.save).toHaveBeenCalledTimes(1);
    const [write, , base] = vi.mocked(api.save).mock.calls[0] ?? [];
    expect(base).toBe(project);
    expect(write).toMatchObject({ activeSequence: 'ACDE', workspace: { schemaVersion: 3 } });
  });

  it('never merges a save into the waiting save of another account', async () => {
    const api = service();
    await ready(api);
    connect(false);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    fireEvent.click(screen.getByRole('button', { name: 'session ends' }));
    fireEvent.click(screen.getByRole('button', { name: 'sign in other' }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'save' })).toBeEnabled(); });
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().pending).toHaveLength(2); });
    expect(state().pending).toEqual([expect.objectContaining({ owner: 'owner' }), expect.objectContaining({ owner: 'other' })]);
  });

  it('follows a repeated create with an update when later content was merged into it', async () => {
    vi.stubEnv('VITE_PROJECT_CREATE_IDEMPOTENCY', 'enabled');
    const api = service();
    const created = { ...project, id: '00000000-0000-4000-8000-000000000020', activeSequence: 'MKWV' };
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(created);
    await ready(api, false);
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWVA' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    later(SYNC_RETRY_DELAYS_MS[0]);
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'saved' })]); });
    expect(api.save).toHaveBeenCalledTimes(3);
    expect(vi.mocked(api.save).mock.calls[1]?.[4]).toBe(vi.mocked(api.save).mock.calls[0]?.[4]);
    expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ activeSequence: 'MKWVA' }), 'owner-token', created, expect.any(AbortSignal));
  });

  it('treats a create cut short as possibly stored: without request ids it is not sent again on its own', async () => {
    const api = service();
    await ready(api, false);
    vi.mocked(api.save).mockImplementationOnce((_write, _token, _base, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => { reject(new ApiError('cancelled')); });
    }));
    connect(false);
    fireEvent.change(screen.getByLabelText('sequence'), { target: { value: 'MKWV' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => { expect(state().queued).toBe('pending'); });
    connect(true);
    await waitFor(() => { expect(api.save).toHaveBeenCalledTimes(1); });
    fireEvent.click(screen.getByRole('button', { name: 'session ends' }));
    fireEvent.click(screen.getByRole('button', { name: 'sign in' }));
    await waitFor(() => { expect(state().pending).toEqual([expect.objectContaining({ state: 'failed', error: 'network' })]); });
    expect(api.save).toHaveBeenCalledTimes(1);
  });
});
