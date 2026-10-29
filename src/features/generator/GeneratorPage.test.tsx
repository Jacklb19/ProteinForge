import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { GeneratorProvider } from './GeneratorProvider';
import { GeneratorPage } from './GeneratorPage';
import { INITIAL_SEARCH_FORM, useGenerator } from './context';
import { searchCandidates } from './search';
import type { SearchRequest, SearchResponse } from './messages';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { ROUTES } from '../../shared/navigation';
import { spanish } from '../../i18n/es';
import { GENERATOR_CONFIG } from './config';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<SearchResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn<(value: SearchRequest) => void>();
  constructor() { TestWorker.instances.push(this); }
  send(value: SearchResponse): void { this.onmessage?.({ data: value } as MessageEvent<SearchResponse>); }
}
function Draft() { const draft = useSequenceDraft(); const alignment = useAlignmentDraft(); const generator = useGenerator(); return <><output data-testid="draft">{draft.text}|{alignment.first}|{alignment.second}</output><button onClick={() => { draft.setText('EEE'); alignment.update({ first: 'FFF', second: 'GGG' }); }}>draft</button><button onClick={() => { generator.setForm({ gravyEnabled: false, massEnabled: false }); generator.run(); }}>invalid</button></>; }
function renderPage() { return render(<MemoryRouter initialEntries={[ROUTES.generate]}><SequenceDraftProvider><AlignmentDraftProvider><GeneratorProvider><Routes><Route path={ROUTES.generate} element={<><GeneratorPage /><Draft /></>} /><Route path={ROUTES.analyze} element={<Draft />} /><Route path={ROUTES.alignment} element={<Draft />} /></Routes></GeneratorProvider></AlignmentDraftProvider></SequenceDraftProvider></MemoryRouter>); }
beforeEach(() => { TestWorker.instances = []; vi.stubGlobal('Worker', TestWorker); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
async function complete(worker: TestWorker): Promise<void> {
  const request = worker.postMessage.mock.calls[0]?.[0]; if (!request) throw new Error('Missing Worker request');
  const result = await searchCandidates(request.parameters);
  await act(async () => { worker.send({ id: request.id, type: 'progress', progress: { completed: 50, total: 200 } }); worker.send({ id: request.id, type: 'result', result }); await Promise.resolve(); });
}
// The provider validates the form with zod, which it loads on demand, so a run reaches its Worker a
// turn after the click. Loading it once here leaves each run costing only that turn.
beforeAll(async () => { await import('./searchForm'); });

/** The Worker of a run, once the turn that loads the form validation has passed. */
async function lastWorker(): Promise<TestWorker> {
  await act(async () => { await Promise.resolve(); });
  const worker = TestWorker.instances.at(-1); if (!worker) throw new Error('Missing Worker'); return worker;
}
/** The page starts one search on arrival; the form stays busy until that run answers. */
async function initialWorker(): Promise<TestWorker> {
  const worker = await lastWorker();
  expect(TestWorker.instances).toHaveLength(1);
  expect(screen.getByRole('button', { name: spanish['generator.run'] })).toBeDisabled();
  return worker;
}
it('opens with a search of the initial conditions already running and shows its result', async () => {
  renderPage();
  const worker = await initialWorker();
  expect(worker.postMessage).toHaveBeenCalledTimes(1);
  expect(worker.postMessage.mock.calls[0]?.[0].parameters).toMatchObject({ length: Number(INITIAL_SEARCH_FORM.length), budget: Number(INITIAL_SEARCH_FORM.budget), seed: Number(INITIAL_SEARCH_FORM.seed) });
  expect(screen.getByText(spanish['generator.running'])).toBeVisible();
  expect(screen.queryByText(spanish['generator.results'])).not.toBeInTheDocument();
  await complete(worker);
  expect(screen.getByText(spanish['generator.done'])).toBeVisible();
  expect(screen.getByRole('heading', { level: 2, name: spanish['generator.results'] })).toBeVisible();
  expect(screen.getByRole('button', { name: spanish['generator.run'] })).toBeEnabled();
  expect(worker.terminate).toHaveBeenCalled();
  expect(TestWorker.instances).toHaveLength(1);
  expect(screen.getByText(spanish['generator.scope']).tagName).toBe('P');
  expect(screen.getByText(spanish['generator.methodTitle'], { selector: 'summary' }).closest('details')).toHaveTextContent(spanish['generator.methodText']);
});
it('marks changed parameters stale and requires deliberate replacement before analyzing', async () => {
  const user = userEvent.setup(); renderPage(); await complete(await initialWorker());
  await user.clear(screen.getByLabelText(spanish['generator.budget'])); await user.type(screen.getByLabelText(spanish['generator.budget']), '100');
  expect(screen.getByText(spanish['generator.stale'])).toBeVisible();
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  const second = await lastWorker();
  expect(TestWorker.instances).toHaveLength(2); expect(second.postMessage.mock.calls[0]?.[0].parameters.budget).toBe(100);
  await complete(second);
  expect(screen.getByText(spanish['generator.done'])).toBeVisible(); expect(screen.queryByText(spanish['generator.stale'])).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText(spanish['generator.seed'])); await user.type(screen.getByLabelText(spanish['generator.seed']), '7');
  expect(screen.getByRole('button', { name: spanish['generator.compare'] })).toBeDisabled();
  await user.clear(screen.getByLabelText(spanish['generator.seed'])); await user.type(screen.getByLabelText(spanish['generator.seed']), '42');
  await user.click(screen.getByRole('button', { name: 'draft' }));
  await user.click(screen.getAllByRole('button', { name: spanish['generator.analyze'] })[0] ?? screen.getByRole('button', { name: 'draft' }));
  await user.click(screen.getByRole('button', { name: spanish['generator.keep'] })); expect(screen.getByTestId('draft')).toHaveTextContent('EEE|FFF|GGG');
  await user.click(screen.getAllByRole('button', { name: spanish['generator.analyze'] })[0] ?? screen.getByRole('button', { name: 'draft' }));
  await user.click(screen.getByRole('button', { name: spanish['generator.confirm'] }));
  expect(screen.getByTestId('draft').textContent.split('|')[0]).toHaveLength(40);
});
it('moves best candidates into alignment only after replacement is confirmed', async () => {
  const user = userEvent.setup(); renderPage(); await user.click(screen.getByRole('button', { name: 'draft' }));
  await complete(await initialWorker());
  await user.click(screen.getByRole('button', { name: spanish['generator.compare'] }));
  expect(screen.getByTestId('draft')).toHaveTextContent('EEE|FFF|GGG');
  await user.click(screen.getByRole('button', { name: spanish['generator.confirm'] }));
  const values = screen.getByTestId('draft').textContent.split('|'); expect(values[1]).toHaveLength(40); expect(values[2]).toHaveLength(40); expect(values[0]).toBe('EEE');
});
it('ignores responses after cancellation and converts Worker failure into a recoverable error', async () => {
  const user = userEvent.setup(); const rendered = renderPage();
  const old = await initialWorker(); await user.click(screen.getByRole('button', { name: spanish['generator.cancel'] }));
  expect(old.terminate).toHaveBeenCalled();
  await complete(old); expect(screen.getByText(spanish['generator.cancelled'])).toBeVisible(); expect(screen.queryByText(spanish['generator.results'])).not.toBeInTheDocument();
  expect(TestWorker.instances).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  const broken = await lastWorker(); expect(TestWorker.instances).toHaveLength(2); act(() => { broken.onerror?.(); });
  expect(screen.getByText(spanish['generator.error'])).toBeVisible();
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  const third = await lastWorker(); expect(TestWorker.instances).toHaveLength(3);
  rendered.unmount(); expect(third.terminate).toHaveBeenCalled();
});
it('terminates a timed out run and allows another attempt', async () => {
  vi.useFakeTimers(); const rendered = renderPage();
  const timedOut = await initialWorker();
  act(() => { vi.advanceTimersByTime(GENERATOR_CONFIG.timeoutMs); }); expect(screen.getByText(spanish['generator.error'])).toBeVisible();
  expect(timedOut.terminate).toHaveBeenCalled(); expect(TestWorker.instances).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  const retried = await lastWorker();
  expect(TestWorker.instances).toHaveLength(2); expect(screen.getByText(spanish['generator.running'])).toBeVisible();
  rendered.unmount(); expect(retried.terminate).toHaveBeenCalled();
});
it('does not create another Worker when all constraints are disabled', async () => {
  const user = userEvent.setup(); renderPage(); await complete(await initialWorker());
  await user.click(screen.getByLabelText(spanish['generator.enableGravy']));
  expect(screen.getByLabelText(spanish['generator.enableGravy'])).not.toBeChecked(); expect(screen.getByLabelText(spanish['generator.enableMass'])).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  expect(screen.getByText(spanish['generator.invalid'])).toBeVisible(); expect(TestWorker.instances).toHaveLength(1);
});
