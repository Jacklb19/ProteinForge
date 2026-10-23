import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { ProjectProvider } from './ProjectProvider';
import { ProjectControls } from './ProjectControls';
import { ProjectLibrary } from './ProjectLibrary';
import type { ProjectApi } from './projectApi';
import type { Project } from './contracts';
import { ApiError } from '../api/apiClient';
import { ProfilePage } from '../profile/ProfilePage';
import { ProjectsPage } from './ProjectsPage';
import { PreferencesProvider } from '../../preferences/PreferencesProvider';
import { ROUTES } from '../../shared/navigation';
import { spanish } from '../../i18n/es';
import { translate } from '../../i18n/translate';
import type { TranslationKey } from '../../i18n';

const message = (key: TranslationKey, variables: Record<string, string | number>): string => translate('es', key, variables);

const project: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Study', activeSequence: 'ACD', status: 'draft', createdAt: '2026-10-12T08:00:00.123456Z', updatedAt: '2026-10-12T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, source: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
function service(): ProjectApi {
  let stored: Project | null = project;
  return {
    list: vi.fn().mockImplementation(() => Promise.resolve({ items: stored ? [stored] : [], nextPageToken: null })),
    open: vi.fn().mockImplementation(() => Promise.resolve(stored)),
    save: vi.fn().mockImplementation((write: Project) => { stored = { ...project, ...write }; return Promise.resolve(stored); }),
    remove: vi.fn().mockImplementation(() => { stored = null; return Promise.resolve(); }),
  };
}
function Draft() { const draft = useSequenceDraft(); return <input aria-label="draft" value={draft.text} onChange={(event) => { draft.setText(event.target.value); }} />; }
/** Stands in for the screens the profile page leads to, and shows where a redirect came from. */
function Destination({ name }: { name: string }) { const location = useLocation(); const from = (location.state as { from?: string } | null)?.from; return <p data-testid="destination">{name}{from ? ` from ${from}` : ''}</p>; }
/**
 * The save controls of a work screen next to the profile page, which owns the "Mis proyectos" section.
 * `bare` renders the list on its own, as a screen without a session requirement would.
 */
function renderPage(api: ProjectApi | null, status: 'signed-in' | 'anonymous' | 'loading' = 'signed-in', bare = false) {
  return render(<MemoryRouter initialEntries={[ROUTES.projects]}><PreferencesProvider><AuthContext.Provider value={{ ...signedInFixture, status, session: status === 'signed-in' ? signedInFixture.session : null }}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={api}>
    <Draft /><ProjectControls />
    {bare ? <ProjectLibrary /> : <Routes><Route path={ROUTES.projects} element={<ProjectsPage />} /><Route path={ROUTES.profile} element={<ProfilePage />} /><Route path={ROUTES.analyze} element={<Destination name={spanish['nav.analyze']} />} /><Route path={ROUTES.signIn} element={<Destination name={spanish['shell.signIn']} />} /></Routes>}
  </ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider></PreferencesProvider></MemoryRouter>);
}
function library(): HTMLElement { return screen.getByRole('region', { name: spanish['projects.title'] }); }
beforeEach(() => { localStorage.clear(); });
it('creates, updates, copies, reloads and detaches a draft through explicit project controls', async () => {
  const user = userEvent.setup(); const api = service(); renderPage(api);
  await waitFor(() => { expect(screen.getByLabelText(spanish['projects.name'])).toBeEnabled(); });
  await user.type(screen.getByLabelText('draft'), 'ACD'); await user.type(screen.getByLabelText(spanish['projects.name']), 'Study');
  await user.click(screen.getByRole('button', { name: spanish['projects.create'] }));
  await screen.findByRole('button', { name: spanish['projects.update'] });
  await user.type(screen.getByLabelText('draft'), 'E');
  await user.click(screen.getByRole('button', { name: spanish['projects.update'] }));
  await waitFor(() => { expect(api.save).toHaveBeenCalledTimes(2); });
  expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ activeSequence: 'ACDE' }), 'owner-token', expect.objectContaining({ id: project.id }), expect.any(AbortSignal));
  await user.click(screen.getByRole('button', { name: spanish['projects.saveCopy'] }));
  await waitFor(() => { expect(api.save).toHaveBeenCalledTimes(3); });
  expect(api.save).toHaveBeenLastCalledWith(expect.anything(), 'owner-token', undefined, expect.any(AbortSignal));
  await user.click(screen.getByRole('button', { name: spanish['projects.reload'] }));
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  expect(screen.getByLabelText('draft')).toHaveValue('ACDE');
  await user.type(screen.getByLabelText('draft'), 'F');
  await user.click(screen.getByRole('button', { name: spanish['projects.reload'] }));
  await user.click(screen.getByRole('button', { name: spanish['projects.confirmOpen'] }));
  await waitFor(() => { expect(screen.getByLabelText('draft')).toHaveValue('ACDE'); });
  await user.click(screen.getByRole('button', { name: spanish['projects.detach'] }));
  expect(screen.getByRole('button', { name: spanish['projects.create'] })).toBeVisible();
  expect(screen.getByLabelText('draft')).toHaveValue('ACDE');
});
it('confirms replacement, rename and delete, preserving the local draft after deletion', async () => {
  const user = userEvent.setup(); const api = service(); const remove = vi.spyOn(api, 'remove'); renderPage(api);
  await screen.findByRole('button', { name: spanish['projects.openNamed'].replace('{{name}}', 'Study') });
  await user.type(screen.getByLabelText('draft'), 'EEE');
  await user.click(screen.getByRole('button', { name: spanish['projects.openNamed'].replace('{{name}}', 'Study') }));
  await user.click(screen.getByRole('button', { name: spanish['projects.confirmOpen'] }));
  await waitFor(() => { expect(screen.getByLabelText('draft')).toHaveValue('ACD'); });
  // An opened project lands on Analizar; the save panel links back to the list.
  expect(screen.getByTestId('destination')).toHaveTextContent(spanish['nav.analyze']);
  await user.click(screen.getByRole('link', { name: spanish['projects.listLink'] }));
  expect(library()).toHaveClass('project-library');
  await user.click(screen.getByLabelText(spanish['projects.actionsNamed'].replace('{{name}}', 'Study')));
  await user.click(screen.getByRole('button', { name: spanish['projects.renameNamed'].replace('{{name}}', 'Study') }));
  const rename = within(library()).getByLabelText(spanish['projects.name']); await user.clear(rename); await user.type(rename, 'Renamed');
  await user.click(screen.getByRole('button', { name: spanish['projects.confirmRename'] }));
  await screen.findByRole('heading', { name: 'Renamed' });
  await user.click(screen.getByLabelText(spanish['projects.actionsNamed'].replace('{{name}}', 'Renamed')));
  await user.click(screen.getByRole('button', { name: spanish['projects.deleteNamed'].replace('{{name}}', 'Renamed') }));
  // The rename already succeeded; a new confirmation must not present that outcome as its own.
  expect(library().querySelector('.project-feedback')).not.toHaveTextContent(spanish['projects.saved']);
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] })); expect(remove).toHaveBeenCalledTimes(0);
  await user.click(screen.getByLabelText(spanish['projects.actionsNamed'].replace('{{name}}', 'Renamed')));
  await user.click(screen.getByRole('button', { name: spanish['projects.deleteNamed'].replace('{{name}}', 'Renamed') }));
  await user.click(screen.getByRole('button', { name: spanish['projects.confirmDelete'] }));
  await screen.findByText(spanish['projects.emptyTitle']); expect(screen.getByLabelText('draft')).toHaveValue('ACD');
});
it('recovers from a conflict, rejects a rename of an unseen revision and deduplicates pagination', async () => {
  const user = userEvent.setup(); const api = service(); api.list = vi.fn().mockResolvedValueOnce({ items: [project], nextPageToken: 'next-page' }).mockResolvedValue({ items: [project], nextPageToken: null });
  api.open = vi.fn().mockResolvedValue({ ...project, updatedAt: '2026-10-12T09:00:00Z' });
  renderPage(api); await user.click(await screen.findByRole('button', { name: spanish['projects.more'] }));
  await waitFor(() => { expect(within(library()).getAllByRole('heading', { name: 'Study' })).toHaveLength(1); });
  await user.click(screen.getByLabelText(spanish['projects.actionsNamed'].replace('{{name}}', 'Study')));
  await user.click(screen.getByRole('button', { name: spanish['projects.renameNamed'].replace('{{name}}', 'Study') }));
  await user.click(screen.getByRole('button', { name: spanish['projects.confirmRename'] }));
  await waitFor(() => { expect(library().querySelector('.project-feedback')).toHaveTextContent(spanish['projects.conflict']); });
  expect(api.save).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  await user.click(screen.getByRole('button', { name: spanish['projects.refresh'] }));
  await waitFor(() => { expect(library().querySelector('.project-feedback')).not.toHaveTextContent(spanish['projects.conflict']); });
});
it('shows account/configuration states and lets an empty library recover from a schema failure', async () => {
  const user = userEvent.setup(); let rendered = renderPage(null, 'anonymous');
  // Without a session the profile page sends the visitor to sign in and remembers where to return.
  expect(screen.getByText(spanish['projects.signInLibrary'])).toBeVisible();
  expect(screen.queryByRole('region', { name: spanish['projects.title'] })).not.toBeInTheDocument();
  expect(screen.getByText(spanish['projects.signInHelp'])).toBeVisible();
  expect(screen.getAllByRole('link', { name: spanish['shell.signIn'] }).map(link => link.getAttribute('href'))).toEqual([ROUTES.signIn, ROUTES.signIn]); rendered.unmount();
  rendered = renderPage(null, 'anonymous', true);
  expect(screen.getByText(spanish['projects.signInLibrary'])).toBeVisible();
  expect(screen.getAllByRole('link', { name: spanish['shell.signIn'] }).map((link) => link.getAttribute('href'))).toEqual([ROUTES.signIn, ROUTES.signIn]); rendered.unmount();
  rendered = renderPage(null, 'loading');
  expect(screen.getAllByText(spanish['projects.sessionLoading'])).toHaveLength(2); expect(screen.queryByTestId('destination')).not.toBeInTheDocument(); rendered.unmount();
  rendered = renderPage(null); expect(screen.getAllByText(spanish['projects.config'])).toHaveLength(2);
  expect(screen.getAllByText(spanish['projects.config'])).toHaveLength(2); rendered.unmount();
  const api = service(); api.list = vi.fn().mockRejectedValueOnce(new ApiError('schema', 'trace-id')).mockResolvedValue({ items: [], nextPageToken: null });
  renderPage(api); await waitFor(() => { expect(library().querySelector('.project-feedback')).toHaveTextContent('trace-id'); });
  await user.click(screen.getByRole('button', { name: spanish['projects.refresh'] })); await screen.findByText(spanish['projects.emptyTitle']);
});

it('counts one saved project in singular and several in plural', async () => {
  const api = service(); const rendered = renderPage(api, 'signed-in', true);
  await screen.findByText(message('projects.loadedOne', { count: 1 }));
  rendered.unmount();
  const second = { ...project, id: '00000000-0000-4000-8000-000000000011', name: 'Second' };
  api.list = vi.fn().mockResolvedValue({ items: [project, second], nextPageToken: null });
  renderPage(api, 'signed-in', true);
  await screen.findByText(message('projects.loaded', { count: 2 }));
});
