import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { ReportActions } from './ReportActions';
import { REPORT_TIMEOUT_MS } from './config';
import type { ReportRequest, ReportResponse } from './reportMessages';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { spanish } from '../../i18n/es';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<ReportResponse>) => void) | null = null; onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn<(value: ReportRequest) => void>();
  constructor() { TestWorker.instances.push(this); }
  send(value: ReportResponse): void { this.onmessage?.({ data: value } as MessageEvent<ReportResponse>); }
}
function Draft() { const draft = useSequenceDraft(); return <input aria-label="draft" value={draft.text} onChange={(event) => { draft.setText(event.target.value); }} />; }
function renderPage(children?: React.ReactNode) { return render(<SequenceDraftProvider><AlignmentDraftProvider><Draft /><ReportActions>{children}</ReportActions></AlignmentDraftProvider></SequenceDraftProvider>); }
// Capturing the workspace loads the project contracts on demand, so the Worker appears a turn after
// the click. Loading them once here leaves each click costing only that turn, never a module read.
beforeAll(async () => { await import('../projects/contracts'); });

/** The Worker of the export, once the turn that loads the contracts has passed. */
async function lastWorker(): Promise<TestWorker> {
  await act(async () => { await Promise.resolve(); });
  const value = TestWorker.instances.at(-1); if (!value) throw new Error('Missing Worker'); return value;
}
const createUrl = vi.fn<(blob: Blob | MediaSource) => string>().mockReturnValue('blob:report');
beforeEach(() => { createUrl.mockClear(); TestWorker.instances = []; vi.stubGlobal('Worker', TestWorker); vi.spyOn(URL, 'createObjectURL').mockImplementation(createUrl); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('exports the current normalized input and downloads only the completed Worker result', async () => {
  const user = userEvent.setup(); renderPage(); expect(screen.queryByText(spanish['report.export'])).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('draft'), 'a c d'); await user.click(screen.getByText(spanish['report.export']));
  await user.click(screen.getByRole('button', { name: spanish['report.json'] }));
  const worker = await lastWorker(); expect(worker.postMessage.mock.calls[0]?.[0]?.format).toBe('json'); expect(worker.postMessage.mock.calls[0]?.[0]?.input.activeSequence).toBe('ACD');
  const blob = new Blob(['{}'], { type: 'application/json' }); act(() => { worker.send({ id: 1, blob }); });
  expect(createUrl).toHaveBeenCalledWith(blob); expect(worker.terminate).toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(spanish['report.done']);
});
it('does not download an export after inputs change or cancellation, and terminates on unmount', async () => {
  const user = userEvent.setup(); const rendered = renderPage(); await user.type(screen.getByLabelText('draft'), 'ACD'); await user.click(screen.getByText(spanish['report.export']));
  await user.click(screen.getByRole('button', { name: spanish['report.pdf'] })); const stale = await lastWorker();
  await user.type(screen.getByLabelText('draft'), 'E'); act(() => { stale.send({ id: 1, blob: new Blob() }); });
  expect(screen.getByRole('status')).toHaveTextContent(spanish['report.stale']); expect(createUrl).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: spanish['report.profileCsv'] })); const cancelled = await lastWorker();
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] })); act(() => { cancelled.send({ id: 1, blob: new Blob() }); });
  expect(createUrl).not.toHaveBeenCalled(); expect(cancelled.terminate).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: spanish['report.pdf'] })); const pending = await lastWorker(); rendered.unmount();
  act(() => { pending.send({ id: 1, blob: new Blob() }); }); expect(pending.terminate).toHaveBeenCalled(); expect(createUrl).not.toHaveBeenCalled();
});
it('keeps failures recoverable and rejects invalid sequence before creating a Worker', async () => {
  const user = userEvent.setup(); renderPage(); await user.type(screen.getByLabelText('draft'), 'AC!'); await user.click(screen.getByText(spanish['report.export']));
  await user.click(screen.getByRole('button', { name: spanish['report.pdf'] })); await act(async () => { await Promise.resolve(); }); expect(TestWorker.instances).toHaveLength(0);
  await user.clear(screen.getByLabelText('draft')); await user.type(screen.getByLabelText('draft'), 'ACD');
  await user.click(screen.getByRole('button', { name: spanish['report.pdf'] })); const failed = await lastWorker(); act(() => { failed.send({ id: 1, error: true }); });
  expect(screen.getByRole('status')).toHaveTextContent(spanish['report.error']);
  await user.click(screen.getByRole('button', { name: spanish['report.pdf'] })); const broken = await lastWorker(); act(() => { broken.onerror?.(); });
  expect(broken.terminate).toHaveBeenCalled(); expect(screen.getByRole('button', { name: spanish['report.pdf'] })).toBeEnabled();
});
it('terminates export on timeout', async () => {
  vi.useFakeTimers(); const rendered = renderPage(); fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'ACD' } }); fireEvent.click(screen.getByText(spanish['report.export']));
  fireEvent.click(screen.getByRole('button', { name: spanish['report.pdf'] }));
  const worker = await lastWorker();
  act(() => { vi.advanceTimersByTime(REPORT_TIMEOUT_MS); });
  expect(worker.terminate).toHaveBeenCalled(); expect(screen.getByRole('status')).toHaveTextContent(spanish['report.error']); rendered.unmount();
});
it('offers the exports and any extra action of the host screen inside one menu', async () => {
  const user = userEvent.setup(); const extra = vi.fn(); const { container } = renderPage(<button type="button" onClick={extra}>{spanish['report.download']}</button>);
  await user.type(screen.getByLabelText('draft'), 'ACD');
  const menu = container.querySelector('details.toolbar-menu'); const summary = screen.getByText(spanish['report.export']);
  expect(summary.tagName).toBe('SUMMARY'); expect(menu).toContainElement(summary);
  await user.click(summary);
  expect(menu).toContainElement(screen.getByRole('status'));
  for (const key of ['report.pdf', 'report.json', 'report.profileCsv', 'report.download'] as const) expect(menu).toContainElement(screen.getByRole('button', { name: spanish[key] }));
  expect(screen.queryByRole('button', { name: spanish['report.alignmentCsv'] })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: spanish['report.download'] }));
  expect(extra).toHaveBeenCalledTimes(1); expect(TestWorker.instances).toHaveLength(0);
});
