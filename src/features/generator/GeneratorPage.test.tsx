import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GeneratorProvider } from './GeneratorProvider';
import { GeneratorPage } from './GeneratorPage';
import { useGenerator } from './context';
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
function lastWorker(): TestWorker { const worker = TestWorker.instances.at(-1); if (!worker) throw new Error('Missing Worker'); return worker; }
it('marks changed parameters stale and requires deliberate replacement before analyzing', async () => {
  const user = userEvent.setup(); renderPage();
  await user.clear(screen.getByLabelText(spanish['generator.budget'])); await user.type(screen.getByLabelText(spanish['generator.budget']), '100');
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] })); await complete(lastWorker());
  expect(screen.getByText(spanish['generator.done'])).toBeVisible();
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
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] })); await complete(lastWorker());
  await user.click(screen.getByRole('button', { name: spanish['generator.compare'] }));
  await user.click(screen.getByRole('button', { name: spanish['generator.confirm'] }));
  const values = screen.getByTestId('draft').textContent.split('|'); expect(values[1]).toHaveLength(40); expect(values[2]).toHaveLength(40); expect(values[0]).toBe('EEE');
});
it('ignores responses after cancellation and converts Worker failure into a recoverable error', async () => {
  const user = userEvent.setup(); const rendered = renderPage(); await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  const old = lastWorker(); await user.click(screen.getByRole('button', { name: spanish['generator.cancel'] }));
  await complete(old); expect(screen.getByText(spanish['generator.cancelled'])).toBeVisible(); expect(screen.queryByText(spanish['generator.results'])).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] })); act(() => { lastWorker().onerror?.(); });
  expect(screen.getByText(spanish['generator.error'])).toBeVisible();
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  rendered.unmount(); expect(lastWorker().terminate).toHaveBeenCalled();
});
it('terminates a timed out run and allows another attempt', () => {
  vi.useFakeTimers(); const rendered = renderPage();
  fireEvent.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  act(() => { vi.advanceTimersByTime(GENERATOR_CONFIG.timeoutMs); }); expect(screen.getByText(spanish['generator.error'])).toBeVisible();
  expect(lastWorker().terminate).toHaveBeenCalled(); rendered.unmount();
});
it('does not create a Worker when all constraints are disabled', async () => {
  const user = userEvent.setup(); renderPage();
  await user.click(screen.getByLabelText(spanish['generator.enableGravy']));
  await user.click(screen.getByRole('button', { name: spanish['generator.run'] }));
  expect(screen.getByText(spanish['generator.invalid'])).toBeVisible(); expect(TestWorker.instances).toHaveLength(0);
});
