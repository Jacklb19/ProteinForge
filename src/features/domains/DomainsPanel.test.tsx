import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LibraryPage } from '../library/LibraryPage';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { OPEN_PROJECT_STATE } from '../editor/config';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { LocaleContext } from '../../i18n/locale';
import type { Locale } from '../../i18n';
import { spanish } from '../../i18n/es';
import { english } from '../../i18n/en';
import { fillMessage } from '../../i18n/message';
import { ROUTES } from '../../shared/navigation';
import { loadDomainCatalog } from './catalog';
import type { DomainEntry } from './catalog';

vi.mock('../library/StructureViewer', () => ({ default: () => <output data-testid="viewer" /> }));

const { domains } = await loadDomainCatalog();
const sh3 = domains.filter((domain) => domain.kind === 'sh3');
const [first, second] = sh3;
if (!first || !second) throw new Error('The catalogue needs two SH3 parts.');
const signal = domains.find((domain) => domain.kind === 'signal');
if (!signal) throw new Error('The catalogue needs a signal peptide.');
const stretch = (domain: DomainEntry): string => fillMessage(spanish['domains.stretch'], { kind: domain.kind === 'sh3' ? spanish['domains.kindSh3'] : spanish['domains.kindSignal'], start: String(domain.feature.start), end: String(domain.feature.end) });
const partName = (domain: DomainEntry): string => `${stretch(domain)} · ${domain.accession}`;

function Analyze() {
  const draft = useSequenceDraft();
  const location = useLocation();
  return <output data-testid="analyze">{draft.text}|{draft.source ? 'source' : 'none'}|{JSON.stringify(location.state)}</output>;
}
function Existing() { const draft = useSequenceDraft(); return <button onClick={() => { draft.setText('EEE'); }}>existing draft</button>; }
function renderLibrary({ signedIn = true, locale = 'es' }: { signedIn?: boolean; locale?: Locale } = {}) {
  return render(
    <LocaleContext.Provider value={locale}>
      <MemoryRouter initialEntries={[ROUTES.library]}>
        <AuthContext.Provider value={signedIn ? signedInFixture : { ...signedInFixture, status: 'anonymous', session: null }}>
          <SequenceDraftProvider>
            <Routes>
              <Route path={ROUTES.library} element={<><LibraryPage mappingLoader={null} /><Existing /></>} />
              <Route path={ROUTES.analyze} element={<Analyze />} />
            </Routes>
          </SequenceDraftProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </LocaleContext.Provider>,
  );
}
/** Opens the tab and waits for the catalogue, which loads only then. */
async function openDomains(user: ReturnType<typeof userEvent.setup>, catalog: Record<keyof typeof spanish, string> = spanish): Promise<HTMLElement> {
  await user.click(screen.getByRole('tab', { name: catalog['domains.tab'] }));
  const panel = screen.getByRole('tabpanel', { name: catalog['domains.tab'] });
  await within(panel).findByRole('complementary', { name: catalog['domains.trayTitle'] });
  return panel;
}
function card(panel: HTMLElement, domain: DomainEntry): HTMLElement {
  const heading = within(panel).getByRole('heading', { level: 3, name: stretch(domain) });
  const item = heading.closest('li');
  if (!item) throw new Error('Missing card.');
  return item;
}

beforeEach(() => { vi.stubEnv('VITE_API_BASE_URL', ''); });
afterEach(() => { vi.unstubAllEnvs(); });

it('loads the catalogue only when its tab opens, then filters by kind and by text', async () => {
  const user = userEvent.setup();
  renderLibrary();
  expect(screen.queryByLabelText(spanish['domains.kind'])).not.toBeInTheDocument();
  const panel = await openDomains(user);
  expect(within(panel).getByText(fillMessage(spanish['domains.count'], { shown: String(domains.length), total: String(domains.length) }))).toBeVisible();

  await user.selectOptions(within(panel).getByLabelText(spanish['domains.kind']), 'sh3');
  expect(within(panel).getByText(fillMessage(spanish['domains.count'], { shown: String(sh3.length), total: String(domains.length) }))).toBeVisible();
  await user.type(within(panel).getByLabelText(spanish['domains.query']), 'no-such-part');
  expect(within(panel).getByText(spanish['domains.noResults'])).toBeVisible();
  await user.click(within(panel).getByRole('button', { name: spanish['domains.clearFilters'] }));
  expect(within(panel).getByLabelText(spanish['domains.kind'])).toHaveValue('');
  expect(within(panel).getByLabelText(spanish['domains.query'])).toHaveValue('');
});

it('shows the provenance of a part and names every source in the active language', async () => {
  const user = userEvent.setup();
  renderLibrary({ locale: 'en' });
  const panel = await openDomains(user, english);
  const heading = within(panel).getByRole('heading', { level: 3, name: fillMessage(english['domains.stretch'], { kind: english['domains.kindSh3'], start: String(first.feature.start), end: String(first.feature.end) }) });
  const item = heading.closest('li');
  if (!item) throw new Error('Missing card.');
  expect(within(item).getByText(fillMessage(english['domains.entry'], { accession: first.accession, entryName: first.entryName, version: String(first.entryVersion) }))).toBeVisible();
  expect(within(item).getByText(first.summary.en)).toBeVisible();
  expect(within(item).getByText(first.sequence)).toBeVisible();
  // The data file names the PDB source in Spanish; the interface does not repeat it in English.
  expect(within(item).queryByText(/vía SIFTS/)).not.toBeInTheDocument();
  expect(within(item).getByText(fillMessage(english['domains.source'], { source: english['domains.sourcePdb'], licence: 'CC0 1.0' }))).toBeVisible();
});

it('joins parts in the chosen order, reorders and removes them, and offers nothing while empty', async () => {
  const user = userEvent.setup();
  renderLibrary();
  const panel = await openDomains(user);
  const tray = within(panel).getByRole('complementary', { name: spanish['domains.trayTitle'] });
  expect(within(tray).getByText(spanish['domains.trayEmpty'])).toBeVisible();
  for (const name of ['domains.analyzeAssembly', 'domains.download', 'domains.save'] as const) {
    expect(within(tray).getByRole('button', { name: spanish[name] })).toBeDisabled();
  }

  const add = (domain: DomainEntry) => within(card(panel, domain)).getByRole('button', { name: spanish['domains.add'] });
  await user.click(add(first));
  expect(add(first)).toHaveAttribute('aria-pressed', 'true');
  expect(within(tray).getByText(fillMessage(spanish['domains.trayTotalOne'], { count: '1', residues: String(first.sequence.length) }))).toBeVisible();
  await user.click(add(signal));
  const residues = first.sequence.length + signal.sequence.length;
  expect(within(tray).getByText(fillMessage(spanish['domains.trayTotal'], { count: '2', residues: String(residues) }))).toBeVisible();
  expect(within(tray).getByText(first.sequence + signal.sequence)).toBeVisible();

  expect(within(tray).getByRole('button', { name: fillMessage(spanish['domains.moveUpLabel'], { name: partName(first) }) })).toBeDisabled();
  await user.click(within(tray).getByRole('button', { name: fillMessage(spanish['domains.moveUpLabel'], { name: partName(signal) }) }));
  expect(within(tray).getByText(signal.sequence + first.sequence)).toBeVisible();
  await user.click(within(tray).getByRole('button', { name: fillMessage(spanish['domains.removeLabel'], { name: partName(signal) }) }));
  expect(add(signal)).toHaveAttribute('aria-pressed', 'false');
  // Choosing an added part again takes it out.
  await user.click(add(first));
  expect(within(tray).getByText(spanish['domains.trayEmpty'])).toBeVisible();
});

it('downloads one FASTA record whose header cites each part', async () => {
  const user = userEvent.setup();
  const created: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => { if (blob instanceof Blob) created.push(blob); return 'blob:assembly'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  renderLibrary();
  const panel = await openDomains(user);
  await user.click(within(card(panel, first)).getByRole('button', { name: spanish['domains.add'] }));
  await user.click(within(card(panel, second)).getByRole('button', { name: spanish['domains.add'] }));
  await user.click(within(panel).getByRole('button', { name: spanish['domains.download'] }));
  expect(click).toHaveBeenCalledOnce();
  const text = await created[0]?.text();
  expect(text?.split('\n')[0]).toContain(`${first.accession}|${first.entryName}|v${String(first.entryVersion)}|${String(first.feature.start)}-${String(first.feature.end)}`);
  expect(text?.split('\n').slice(1).join('')).toBe(first.sequence + second.sequence);
  vi.restoreAllMocks();
});

it('hands a part to Analyze without a source and confirms before replacing a draft', async () => {
  const user = userEvent.setup();
  renderLibrary();
  await user.click(screen.getByRole('button', { name: 'existing draft' }));
  const panel = await openDomains(user);
  await user.click(within(card(panel, first)).getByRole('button', { name: spanish['domains.analyzePart'] }));
  await user.click(screen.getByRole('button', { name: spanish['domains.confirmLoad'] }));
  expect(screen.getByTestId('analyze')).toHaveTextContent(`${first.sequence}|none|`);
});

it('sends an assembly to Analyze with project saving open, and only with a session', async () => {
  const user = userEvent.setup();
  const { unmount } = renderLibrary({ signedIn: false });
  let panel = await openDomains(user);
  await user.click(within(card(panel, first)).getByRole('button', { name: spanish['domains.add'] }));
  expect(within(panel).getByRole('button', { name: spanish['domains.save'] })).toBeDisabled();
  expect(within(panel).getByText(spanish['domains.saveNeedsSession'])).toBeVisible();
  unmount();

  renderLibrary();
  panel = await openDomains(user);
  await user.click(within(card(panel, first)).getByRole('button', { name: spanish['domains.add'] }));
  await user.click(within(panel).getByRole('button', { name: spanish['domains.save'] }));
  expect(screen.getByTestId('analyze')).toHaveTextContent(`${first.sequence}|none|${JSON.stringify(OPEN_PROJECT_STATE)}`);
});
