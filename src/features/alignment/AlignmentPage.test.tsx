import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlignmentPage } from './AlignmentPage';
import type { AlignmentRequest, AlignmentResponse } from './messages';
import { alignSequences } from './gotoh';
import type { AlignmentResult } from './gotoh';
import { countGapColumns } from './alignmentSummary';
import { changesInside } from './columns';
import { EXAMPLE_ALIGNMENT_INPUT } from './examples';
import { annotationsForAccession } from '../editor/annotations';
import { MODE_LABEL_KEYS, PERCENT_FORMAT, TERMINAL_GAP_LABEL_KEYS } from './config';
import { ExampleProviders, WorkspaceProviders } from '../../test/WorkspaceProviders';
import { spanish } from '../../i18n/es';
import { DEFAULT_LOCALE, languageTags } from '../../i18n/config';
import { translate } from '../../i18n/translate';

class MockWorker {
  static instance: MockWorker | null = null;
  onmessage: ((event: MessageEvent<AlignmentResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(message: AlignmentRequest) => void>();
  terminate = vi.fn();
  constructor() { MockWorker.instance = this; }
}

class MockResizeObserver {
  observe(): void { /* Layout is controlled by the test. */ }
  disconnect(): void { /* No pending observer work. */ }
}

const result: AlignmentResult = {
  alignedFirst: 'ACDE', alignedSecond: 'ACDE', marks: '||||', score: 24,
  columns: 4, identities: 4, similarities: 4,
  parameters: { matrix: 'BLOSUM62', mode: 'global', gapOpen: 10, gapExtend: 0.5, terminalGaps: 'free' },
};

function worker(): MockWorker {
  if (!MockWorker.instance) throw new Error('The alignment worker was not created.');
  return MockWorker.instance;
}

/** Text of the definition paired with a visible term in the result summary. */
function definition(term: string): string | null | undefined {
  return screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
}

function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(languageTags[DEFAULT_LOCALE], options).format(value);
}

function enterSequences(first: string, second: string): void {
  fireEvent.change(screen.getByLabelText(spanish['alignment.first']), { target: { value: first } });
  fireEvent.change(screen.getByLabelText(spanish['alignment.second']), { target: { value: second } });
}

beforeEach(() => {
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterEach(() => { vi.unstubAllGlobals(); MockWorker.instance = null; });

describe('alignment interface', () => {
  it('rejects empty, invalid, and overlong sequences without starting a worker task', () => {
    render(<AlignmentPage />, { wrapper: WorkspaceProviders });
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    expect(screen.getByRole('status')).toHaveTextContent(spanish['alignment.empty']);
    expect(screen.queryByText(translate(DEFAULT_LOCALE, 'alignment.limit', { count: '5.000' }))).not.toBeInTheDocument();
    enterSequences('AC-', 'AC');
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    expect(screen.getByRole('status')).toHaveTextContent(spanish['alignment.invalid']);
    enterSequences('A'.repeat(5001), 'AC');
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    expect(screen.getByRole('status')).toHaveTextContent(translate(DEFAULT_LOCALE, 'alignment.limit', { count: '5.000' }));
    expect(worker().postMessage).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'global', terminalGaps: 'free' },
    { mode: 'local', terminalGaps: 'not-applicable' },
  ] as const)('keeps exact $mode parameters, ignores old responses, and shows textual metrics', ({ mode, terminalGaps }) => {
    const label = spanish[MODE_LABEL_KEYS[mode]];
    const { container } = render(<AlignmentPage />, { wrapper: WorkspaceProviders });
    enterSequences('ACDE*', 'ACDE');
    fireEvent.click(screen.getByRole('radio', { name: 'BLOSUM80' }));
    fireEvent.click(screen.getByRole('radio', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
    const request = worker().postMessage.mock.calls[0]?.[0];
    expect(request).toMatchObject({ type: 'start', first: 'ACDE', second: 'ACDE', matrix: 'BLOSUM80', mode });
    if (!request) throw new Error('No task request was sent.');
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'result', id: request.id - 1, result } })); });
    expect(screen.queryByText(spanish['alignment.result'])).not.toBeInTheDocument();
    expect(container.querySelector('.verdict')).toBeNull();
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'progress', id: request.id, fraction: 0.5 } })); });
    expect(screen.getByRole('status')).toHaveTextContent('50%');
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0.5');
    fireEvent.click(screen.getByRole('radio', { name: 'BLOSUM45' }));
    const storedResult: AlignmentResult = { ...result, parameters: { ...result.parameters, matrix: 'BLOSUM80', mode, terminalGaps } };
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'result', id: request.id, result: storedResult } })); });
    expect(screen.getByRole('heading', { level: 2, name: spanish['alignment.result'] })).toBeInTheDocument();
    expect(container.querySelector('.verdict')).toHaveTextContent(translate(DEFAULT_LOCALE, 'alignment.verdict', { count: '4', total: '4' }));
    expect(definition(spanish['alignment.identity'])).toBe(formatNumber(1, PERCENT_FORMAT));
    expect(definition(spanish['alignment.identity'])).toMatch(/^100\s?%$/);
    expect(definition(spanish['alignment.gaps'])).toBe('0');
    expect(screen.getByText(spanish['alignment.stale'])).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(definition(spanish['alignment.similarity'])).toBe(formatNumber(1, PERCENT_FORMAT));
    expect(definition(spanish['alignment.score'])).toBe('24');
    expect(screen.getByRole('img', { name: translate(DEFAULT_LOCALE, 'alignment.mapLabel', { identical: '4', total: '4' }) }).children).toHaveLength(4);
    expect(screen.getByText(translate(DEFAULT_LOCALE, 'alignment.parameters', {
      matrix: 'BLOSUM80', mode: label, open: '10', extend: '0,5', ends: spanish[TERMINAL_GAP_LABEL_KEYS[terminalGaps]],
    }))).toBeInTheDocument();
  });

  it('opens the untouched example already sent to the worker and names both references', async () => {
    const { container } = render(<AlignmentPage />, { wrapper: ExampleProviders });
    const human = spanish['library.insulin'];
    const bovine = spanish['library.bovineInsulin'];
    expect(screen.getByLabelText(human)).toHaveValue(EXAMPLE_ALIGNMENT_INPUT.first);
    expect(screen.getByLabelText(bovine)).toHaveValue(EXAMPLE_ALIGNMENT_INPUT.second);
    expect(screen.queryByLabelText(spanish['alignment.first'])).not.toBeInTheDocument();
    const title = translate(DEFAULT_LOCALE, 'alignment.pairTitle', { first: human, second: bovine });
    expect(screen.getByRole('heading', { level: 1 }).textContent.toLocaleLowerCase(DEFAULT_LOCALE)).toBe(title.toLocaleLowerCase(DEFAULT_LOCALE));
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
    expect(worker().postMessage.mock.calls[0]?.[0]).toEqual({ type: 'start', id: 1, ...EXAMPLE_ALIGNMENT_INPUT });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: spanish['alignment.start'] })).toBeDisabled();

    const example = await alignSequences(EXAMPLE_ALIGNMENT_INPUT.first, EXAMPLE_ALIGNMENT_INPUT.second, { matrix: EXAMPLE_ALIGNMENT_INPUT.matrix, mode: EXAMPLE_ALIGNMENT_INPUT.mode });
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'result', id: 1, result: example } })); });
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(spanish['alignment.stale'])).not.toBeInTheDocument();
    expect(container.querySelector('.verdict')).toHaveTextContent(translate(DEFAULT_LOCALE, 'alignment.verdict', { count: formatNumber(example.identities), total: formatNumber(example.columns) }));
    expect(definition(spanish['alignment.identity'])).toBe(formatNumber(example.identities / example.columns, PERCENT_FORMAT));
    expect(definition(spanish['alignment.similarity'])).toBe(formatNumber(example.similarities / example.columns, PERCENT_FORMAT));
    expect(definition(spanish['alignment.gaps'])).toBe(formatNumber(countGapColumns(example)));
    expect(definition(spanish['alignment.score'])).toBe(formatNumber(example.score));
    const mature = annotationsForAccession('P01308')?.regions.filter((region) => region.mature) ?? [];
    const changes = changesInside(example, mature);
    expect(container.querySelector('.verdict-note')).toHaveTextContent(translate(DEFAULT_LOCALE, 'alignment.matureNote', {
      regions: mature.map((region) => spanish[region.labelKey]).join(spanish['alignment.regionJoin']), inside: formatNumber(changes.inside), outside: formatNumber(changes.outside),
    }));
    expect(container.querySelector('.alignment-block-head')).toHaveTextContent(human);
    expect(container.querySelector('.alignment-block-foot')).toHaveTextContent(bovine);

    // Editing a sequence keeps the result on screen, marked as stale, and returns the generic field name.
    fireEvent.change(screen.getByLabelText(bovine), { target: { value: 'ACDE' } });
    expect(screen.getByLabelText(spanish['alignment.second'])).toHaveValue('ACDE');
    expect(screen.getByText(spanish['alignment.stale'])).toBeInTheDocument();
    expect(container.querySelector('.verdict-note')).toBeNull();
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
  });

  it('warns for U and O and handles cancellation and worker failures', () => {
    render(<AlignmentPage />, { wrapper: WorkspaceProviders });
    enterSequences('UOBZX', 'CKBZX');
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    expect(screen.getByText(spanish['alignment.warningU'])).toBeInTheDocument();
    expect(screen.getByText(spanish['alignment.warningO'])).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.cancel'] }));
    expect(worker().postMessage.mock.calls.at(-1)?.[0]).toEqual({ type: 'cancel', id: 1 });
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'cancelled', id: 1 } })); });
    expect(screen.getByRole('status')).toHaveTextContent(spanish['alignment.cancelled']);
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'error', id: 2, message: { key: 'alignment.workerError' } } })); });
    expect(screen.getByRole('status')).toHaveTextContent(spanish['alignment.workerError']);
    act(() => { worker().onerror?.(); });
    expect(screen.getByRole('button', { name: spanish['alignment.start'] })).toBeEnabled();
  });

  it('reports unavailable worker support', async () => {
    vi.stubGlobal('Worker', vi.fn(function unavailableWorker() { throw new Error('Unavailable'); }));
    render(<AlignmentPage />, { wrapper: WorkspaceProviders });
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent(spanish['alignment.workerStartError']); });
    enterSequences('AC', 'AC');
    fireEvent.click(screen.getByRole('button', { name: spanish['alignment.start'] }));
    expect(screen.getByRole('status')).toHaveTextContent(spanish['alignment.workerStartError']);
  });
});
