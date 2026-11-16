import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { spanish } from '../../i18n/es';
import { ROUTES } from '../../shared/navigation';
import { signedInFixture } from '../../test/authFixture';
import { AuthContext } from '../auth/authContext';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import type { UniProtEntry } from '../library/libraryApi';
import { ModelError } from './alphafold';
import { ALPHAFOLD_FILES_URL, EXPLORE_PARAM, STOP_GROUP_PREVIEW } from './config';
import { ExplorePage } from './ExplorePage';
import type { StructureFocus } from './PredictedStructure';

const viewer = vi.hoisted(() => ({ pick: null as ((position: number | null) => void) | null }));
vi.mock('./PredictedStructure', () => ({
  default: ({ focus, caption, onPick }: { focus: StructureFocus | null; caption?: string | null; onPick: (position: number | null) => void }) => {
    viewer.pick = onPick;
    return <><output data-testid="model">{focus ? `${focus.positions.join(',')}|${focus.sticks ? 'sticks' : 'ribbon'}` : 'whole'}</output><output data-testid="caption">{caption}</output></>;
  },
}));

const entry: UniProtEntry = {
  accession: 'P00698', name: 'Lysozyme C', organism: 'Gallus gallus', reviewed: true, length: 30, sequence: 'KVFGRCELAAAMKRHGLDNYRGYSLGNWVC', entryVersion: 253, sequenceVersion: 1,
  retrievedAt: '2026-11-14T16:30:00Z', function: 'Bacteriolytic function.', structures: [], featuresTruncated: false,
  features: [
    { kind: 'variant', description: 'E > Q', begin: 7, end: 7, paired: false },
    { kind: 'disulfide', description: '', begin: 6, end: 30, paired: true },
    { kind: 'domain', description: 'C-type lysozyme', begin: 3, end: 30, paired: false },
    { kind: 'active-site', description: '', begin: 7, end: 7, paired: false },
  ],
};
const model = { url: `${ALPHAFOLD_FILES_URL}AF-P00698-F1-model_v6.bcif`, version: 6, confidence: 93.88 };
const text = (key: keyof typeof spanish, variables: Record<string, string> = {}) => Object.entries(variables).reduce<string>((value, [name, replacement]) => value.replace(`{{${name}}}`, replacement), spanish[key]);

function Draft() { const draft = useSequenceDraft(); return <output data-testid="draft">{draft.text}|{draft.source?.accession}</output>; }
function renderPage(loaders: Parameters<typeof ExplorePage>[0]['loaders'], address: string = ROUTES.explore) {
  return render(
    <MemoryRouter initialEntries={[address]}><AuthContext.Provider value={signedInFixture}><SequenceDraftProvider>
      <Routes><Route path={ROUTES.explore} element={<ExplorePage loaders={loaders} />} /><Route path={ROUTES.analyze} element={<Draft />} /></Routes>
    </SequenceDraftProvider></AuthContext.Provider></MemoryRouter>,
  );
}

beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => { callback(0); }, 0)); });
afterEach(() => { vi.unstubAllGlobals(); viewer.pick = null; });

it('walks the stops in tour order, saying where each one is and what it means', async () => {
  const user = userEvent.setup();
  const loadEntry = vi.fn().mockResolvedValue(entry);
  const { container } = renderPage({ entry: loadEntry, model: () => Promise.resolve(model) });
  expect(await screen.findByRole('heading', { level: 2, name: entry.name })).toBeVisible();
  expect(loadEntry).toHaveBeenCalledWith('P00698', signedInFixture.session?.accessToken, expect.any(AbortSignal));
  expect(await screen.findByTestId('model')).toHaveTextContent('whole');
  expect(screen.getByText(text('explore.modelProvenance', { version: '6', score: '94', band: spanish['explore.confidenceVeryHigh'] }), { exact: false })).toBeVisible();
  expect(screen.getByText(text('explore.tourCount', { count: '4' }), { exact: false })).toBeVisible();
  // What the protein does comes first, whatever order the entry lists it in.
  expect([...container.querySelectorAll('.explore-stop-kind')].map(item => item.textContent))
    .toEqual([spanish['explore.kindActiveSite'], spanish['explore.kindDomain'], spanish['explore.kindDisulfide'], spanish['explore.kindVariant']]);

  await user.click(screen.getByRole('button', { name: spanish['explore.tourStart'] }));
  // Each stop's reading is a new element, so it is looked up again after every step.
  const reading = (): HTMLElement => screen.getByRole('article');
  await waitFor(() => { expect(within(reading()).getByRole('heading', { name: spanish['explore.kindActiveSite'] })).toHaveFocus(); });
  expect(within(reading()).getByText(text('explore.residue', { name: 'Glu', position: '7' }))).toBeVisible();
  expect(within(reading()).getByText(spanish['explore.meansActiveSite'])).toBeVisible();
  expect(screen.getByTestId('model')).toHaveTextContent('7|sticks');

  await user.click(within(reading()).getByRole('button', { name: spanish['explore.tourNext'] }));
  expect(within(reading()).getByText(text('explore.spanSize', { count: '28', begin: '3', end: '30' }))).toBeVisible();
  expect(within(reading()).getByText('C-type lysozyme')).toBeVisible();
  // A whole domain is marked on the ribbon; its side chains are not drawn.
  expect(screen.getByTestId('model')).toHaveTextContent('|ribbon');
  await user.click(within(reading()).getByRole('button', { name: spanish['explore.tourNext'] }));
  expect(screen.getByTestId('model')).toHaveTextContent('6,30|sticks');
  await user.click(within(reading()).getByRole('button', { name: spanish['explore.tourWhole'] }));
  expect(screen.getByTestId('model')).toHaveTextContent('whole');
});

it('names a residue picked on the model and the stops it belongs to', async () => {
  const user = userEvent.setup();
  renderPage({ entry: () => Promise.resolve(entry), model: () => Promise.resolve(model) });
  await screen.findByTestId('model');
  act(() => { viewer.pick?.(7); });
  expect(screen.getByText(text('explore.pickedTitle', { position: '7', name: 'Glu' }))).toBeVisible();
  expect(screen.getByTestId('model')).toHaveTextContent('7|sticks');
  await user.click(screen.getByRole('button', { name: `${spanish['explore.kindVariant']} · ${text('explore.single', { begin: '7' })}` }));
  expect(within(screen.getByRole('article')).getByText('E > Q')).toBeVisible();
  act(() => { viewer.pick?.(2); });
  expect(screen.getByText(spanish['explore.pickedNone'])).toBeVisible();
  // A pick outside the sequence on screen is not a residue of this protein.
  act(() => { viewer.pick?.(99); });
  expect(screen.queryByText(spanish['explore.pickedNone'])).not.toBeInTheDocument();
});

it('tries a substitution on the residue of a stop, says what is annotated there and takes the variant to the analysis', async () => {
  const user = userEvent.setup();
  renderPage({ entry: () => Promise.resolve(entry), model: () => Promise.resolve(model) });
  await screen.findByTestId('model');
  // A whole domain is not one residue: nothing to substitute until a single one is on screen.
  expect(screen.queryByRole('heading', { name: spanish['mutation.title'] })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: spanish['explore.tourStart'] }));
  expect(screen.getByRole('heading', { name: spanish['mutation.title'] })).toBeVisible();
  expect(screen.getByLabelText(text('mutation.replace', { residue: 'Glu', position: '7' }))).toBeVisible();
  expect(screen.getByText(text('explore.trialAnnotated', { stops: `${spanish['explore.kindActiveSite']} (${text('explore.single', { begin: '7' })})` }))).toBeVisible();
  expect(screen.getByText(text('explore.trialVariants', { variants: 'E > Q' }))).toBeVisible();
  await user.selectOptions(screen.getByLabelText(text('mutation.replace', { residue: 'Glu', position: '7' })), 'Q');
  await user.click(screen.getByRole('button', { name: spanish['explore.trialApply'] }));
  // The variant is a sequence of its own: it no longer carries the reference's provenance.
  expect(await screen.findByTestId('draft')).toHaveTextContent(`${entry.sequence.slice(0, 6)}Q${entry.sequence.slice(7)}|`);
  expect(screen.getByTestId('draft')).not.toHaveTextContent('P00698');
});

it('keeps the tour as text when there is no model, and opens the protein named in the address', async () => {
  const user = userEvent.setup();
  const loadEntry = vi.fn().mockResolvedValue({ ...entry, accession: 'P01308' });
  renderPage({ entry: loadEntry, model: () => Promise.reject(new ModelError('partial')) }, `${ROUTES.explore}?${EXPLORE_PARAM}=p01308`);
  expect(await screen.findByText(spanish['explore.modelPartial'], { exact: false })).toBeVisible();
  expect(loadEntry).toHaveBeenCalledWith('P01308', expect.anything(), expect.any(AbortSignal));
  expect(screen.queryByTestId('model')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: spanish['explore.tourStart'] }));
  expect(within(screen.getByRole('article')).getByText(spanish['explore.meansActiveSite'])).toBeVisible();
});

it('reports an entry that cannot be opened, retries it, and takes the sequence to the analysis after confirming', async () => {
  const user = userEvent.setup();
  const loadEntry = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(entry);
  renderPage({ entry: loadEntry, model: () => Promise.resolve(model) });
  expect(await screen.findByText(spanish['explore.entryError'])).toBeVisible();
  await user.click(screen.getByRole('button', { name: spanish['explore.entryRetry'] }));
  expect(await screen.findByRole('heading', { level: 2, name: entry.name })).toBeVisible();
  await user.click(screen.getByRole('button', { name: spanish['explore.analyze'] }));
  expect(await screen.findByTestId('draft')).toHaveTextContent(`${entry.sequence}|P00698`);
});

it('folds a long function text without its references, shows the first stops of a long group and names the stop over the model', async () => {
  const user = userEvent.setup();
  const sentence = 'Mediates the transport of chloride ions across the cell membrane (PubMed:10792060, PubMed:11524016). ';
  const modified = Array.from({ length: STOP_GROUP_PREVIEW + 2 }, (_, index) => ({ kind: 'modified-residue', description: 'Phosphoserine; by PKA', begin: index + 1, end: index + 1, paired: false }));
  const long = { ...entry, function: sentence.repeat(6), features: modified };
  renderPage({ entry: () => Promise.resolve(long), model: () => Promise.resolve(model) });
  expect(await screen.findByRole('heading', { level: 2, name: entry.name })).toBeVisible();

  // The references are gone and the text opens on request.
  const more = screen.getByRole('button', { name: spanish['explore.readMore'] });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById('explore-function-text')?.textContent).not.toContain('PubMed');
  await user.click(more);
  expect(screen.getByRole('button', { name: spanish['explore.readLess'] })).toHaveAttribute('aria-expanded', 'true');

  // A long group lists its first stops, translated where UniProt's wording is known, and opens on request.
  const stops = () => document.querySelectorAll('#explore-stops-chemistry .explore-stop');
  expect(stops()).toHaveLength(STOP_GROUP_PREVIEW);
  expect(stops()[0]).toHaveTextContent('Fosfoserina; por PKA');
  await user.click(screen.getByRole('button', { name: text('explore.showAll', { count: String(modified.length) }) }));
  expect(stops()).toHaveLength(modified.length);

  // Before the tour the invitation says how many stops there are; then the model is captioned with the stop.
  expect(screen.getByText(text('explore.wholeHelp', { count: String(modified.length) }))).toBeVisible();
  expect(screen.getByTestId('caption')).toBeEmptyDOMElement();
  await user.click(screen.getByRole('button', { name: spanish['explore.tourStart'] }));
  expect(screen.getByTestId('caption')).toHaveTextContent(text('explore.caption', { index: '1', total: String(modified.length), kind: spanish['explore.kindModifiedResidue'], place: text('explore.single', { begin: '1' }) }));
});
