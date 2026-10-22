import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';

const listProjects = vi.fn();
let available = false;
// Stands in for the file that could not be fetched: the import settles as a rejection either way.
vi.mock('./projectApi', () => ({
  createProjectApi: () => {
    if (!available) throw new Error('chunk unavailable');
    return { list: listProjects, open: vi.fn(), save: vi.fn(), remove: vi.fn() };
  },
}));

function Harness(): React.JSX.Element {
  const projects = useProjects();
  return <>
    <output data-testid="state">{JSON.stringify({ enabled: projects.enabled, busy: projects.busy, error: projects.error?.code, items: projects.items.length })}</output>
    <button onClick={() => { void projects.refresh(); }}>refresh</button>
  </>;
}
function state(): { enabled: boolean; busy: boolean; error?: string; items: number } {
  return JSON.parse(screen.getByTestId('state').textContent) as ReturnType<typeof state>;
}

beforeEach(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.invalid'); listProjects.mockResolvedValue({ items: [], nextPageToken: null }); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function mount() {
  // `api` is left out on purpose: this is the configured path that fetches the client on demand.
  return render(<AuthContext.Provider value={signedInFixture}><SequenceDraftProvider><AlignmentDraftProvider>
    <ProjectProvider><Harness /></ProjectProvider>
  </AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>);
}

it('reports the collection as available and loads the client once it is needed', async () => {
  available = true;
  mount();
  expect(state().enabled).toBe(true);
  await waitFor(() => { expect(listProjects).toHaveBeenCalled(); });
});

it('reports a failure and stays usable when the client cannot be fetched', async () => {
  available = false;
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'refresh' }));
  // The provider must not stay locked: a second attempt still reaches the error path.
  await waitFor(() => { expect(state().error).toBe('network'); });
  await user.click(screen.getByRole('button', { name: 'refresh' }));
  await waitFor(() => { expect(state()).toMatchObject({ error: 'network', busy: false }); });
});
