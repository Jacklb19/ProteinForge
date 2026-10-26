import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';

const deferred = vi.hoisted(() => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { release, promise, loaded: vi.fn(), save: vi.fn(), list: vi.fn().mockResolvedValue({ items: [], nextPageToken: null }) };
});
vi.mock('./projectApi', async () => {
  deferred.loaded();
  await deferred.promise;
  return { createProjectApi: () => ({ save: deferred.save, list: deferred.list }) };
});
function Probe() {
  const projects = useProjects();
  return <button onClick={() => { void projects.save('Study'); }}>save</button>;
}

it('does not send a queued save after sign-out while the client module is loading', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.e2e.invalid');
  const content = (signedIn: boolean) => <AuthContext.Provider value={signedIn ? signedInFixture : { ...signedInFixture, status: 'anonymous', session: null }}>
    <SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider><Probe /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider>
  </AuthContext.Provider>;
  const view = render(content(true));
  await waitFor(() => { expect(deferred.loaded).toHaveBeenCalledOnce(); });
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  view.rerender(content(false));
  await act(async () => { deferred.release(); await deferred.promise; });
  expect(deferred.save).not.toHaveBeenCalled();
  expect(deferred.list).not.toHaveBeenCalled();
  view.rerender(content(true));
  await waitFor(() => { expect(deferred.list).toHaveBeenCalledOnce(); });
  expect(deferred.list.mock.calls[0]?.[0]).toBe('owner-token');
  expect(deferred.save).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});
