import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LibraryPage } from './LibraryPage';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { spanish } from '../../i18n/es';
import { ROUTES } from '../../shared/navigation';
import type { UniProtEntry } from './libraryApi';

vi.mock('./StructureViewer', () => ({ default: ({ pdbId }: { pdbId: string }) => <output data-testid="viewer">{pdbId}</output> }));
const entry: UniProtEntry = { accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', reviewed: true, length: 3, sequence: 'ACD', entryVersion: 284, sequenceVersion: 1, retrievedAt: '2026-10-12T08:00:00Z', function: 'Public annotation', structures: [{ id: '1TRZ', method: 'X-ray', resolution: '1.60 A', chains: 'A=1-3' }] };
function Draft() { const draft = useSequenceDraft(); return <><output data-testid="draft">{draft.text}|{draft.source?.accession}</output><button onClick={() => { draft.setText('EEE'); }}>existing draft</button></>; }
function renderPage(signedIn = true) { return render(<MemoryRouter initialEntries={[ROUTES.library]}><AuthContext.Provider value={signedIn ? signedInFixture : { ...signedInFixture, status: 'anonymous', session: null }}><SequenceDraftProvider><Routes><Route path={ROUTES.library} element={<><LibraryPage /><Draft /></>} /><Route path={ROUTES.analyze} element={<Draft />} /></Routes></SequenceDraftProvider></AuthContext.Provider></MemoryRouter>); }
beforeEach(() => { vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('queries public references on demand, validates provenance and imports after deliberate draft replacement', async () => {
  const user = userEvent.setup(); const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/search?') ? { items: [entry], limit: 10, truncated: true, retrievedAt: entry.retrievedAt } : entry), { status: 200 })));
  vi.stubGlobal('fetch', fetcher); renderPage();
  expect(fetcher).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText(spanish['library.query']), ' human');
  await user.click(screen.getByRole('button', { name: spanish['library.search'] }));
  await screen.findByRole('button', { name: spanish['library.openEntry'].replace('{{id}}', 'P01308') });
  expect(screen.getByText(spanish['library.truncated'], { exact: false })).toBeVisible();
  await user.click(screen.getByRole('button', { name: spanish['library.openEntry'].replace('{{id}}', 'P01308') }));
  await screen.findByText('Public annotation');
  await user.selectOptions(screen.getByLabelText(spanish['library.structureChoose']), '1TRZ');
  await waitFor(() => { expect(screen.getByTestId('viewer')).toHaveTextContent('1TRZ'); });
  await user.click(screen.getByRole('button', { name: spanish['library.closeViewer'] }));
  expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'existing draft' }));
  await user.click(within(screen.getByRole('article')).getByRole('button', { name: spanish['library.load'] }));
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  expect(screen.getByTestId('draft')).toHaveTextContent('EEE|');
  await user.click(within(screen.getByRole('article')).getByRole('button', { name: spanish['library.load'] }));
  await user.click(screen.getByRole('button', { name: spanish['library.confirmLoad'] }));
  expect(screen.getByTestId('draft')).toHaveTextContent('ACD|P01308');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('aborts cancelled lookups, ignores their late response and displays real provider errors', async () => {
  const user = userEvent.setup(); let resolve: (value: Response) => void = () => undefined;
  const fetcher = vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal('fetch', fetcher);
  renderPage(); await user.click(screen.getByRole('button', { name: spanish['library.search'] }));
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  await act(async () => { resolve(new Response(JSON.stringify({ items: [entry], limit: 10, truncated: false, retrievedAt: entry.retrievedAt }), { status: 200 })); await Promise.resolve(); });
  expect(screen.queryByRole('button', { name: spanish['library.openEntry'].replace('{{id}}', 'P01308') })).not.toBeInTheDocument();
  fetcher.mockResolvedValue(new Response('service unavailable', { status: 503 }));
  await user.click(screen.getByRole('button', { name: spanish['library.search'] }));
  await screen.findByText(spanish['library.error']);
});
it('keeps bundled references usable without identity or a configured API', async () => {
  const user = userEvent.setup(); const rendered = renderPage(false);
  expect(screen.queryByRole('button', { name: spanish['library.search'] })).not.toBeInTheDocument();
  await user.click(screen.getAllByRole('button', { name: spanish['library.load'] })[0] ?? screen.getByRole('button', { name: 'existing draft' }));
  expect(screen.getByTestId('draft')).toHaveTextContent('MALWMR');
  rendered.unmount(); vi.stubEnv('VITE_API_BASE_URL', ''); renderPage();
  expect(screen.getByText(spanish['library.config'])).toBeVisible();
});
it('rejects a detail whose sequence does not match its declared length', async () => {
  const user = userEvent.setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [entry], limit: 10, truncated: false, retrievedAt: entry.retrievedAt }))).mockResolvedValueOnce(new Response(JSON.stringify({ ...entry, sequence: 'AC' }))));
  renderPage(); await user.click(screen.getByRole('button', { name: spanish['library.search'] }));
  await user.click(await screen.findByRole('button', { name: spanish['library.openEntry'].replace('{{id}}', 'P01308') }));
  await screen.findByText(spanish['library.error']); expect(screen.queryByText('Public annotation')).not.toBeInTheDocument();
});
