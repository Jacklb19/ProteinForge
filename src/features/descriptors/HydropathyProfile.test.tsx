import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import { HydropathyProfile } from './HydropathyProfile';
import { calculateProfile } from './profile';
import { calculatePropensities } from './chouFasman';
import type { ResiduePropensity } from './chouFasman';
import { PROFILE_VALUE_FORMAT, RESIDUES_PER_BLOCK } from './config';
import { RESIDUE_NAMES } from '../chemistry/config';
import { annotationsFor } from '../editor/annotations';
import { DEFAULT_EXAMPLE } from '../editor/examples';
import { spanish } from '../../i18n/es';
import { DEFAULT_LOCALE, languageTags } from '../../i18n/config';
import { translate } from '../../i18n/translate';
import type { TranslationKey, TranslationVariables } from '../../i18n/translate';

class MockWorker {
  static instance: MockWorker | null = null;
  onmessage: ((event: MessageEvent<ProfileResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(message: ProfileRequest, transferables?: Transferable[]) => void>();
  terminate = vi.fn();
  constructor() { MockWorker.instance = this; }
}

function profileWorker(): MockWorker {
  if (!MockWorker.instance) throw new Error('The profile worker was not created.');
  return MockWorker.instance;
}

function lastRequest(worker: MockWorker): Extract<ProfileRequest, { type: 'calculate' }> {
  const message = worker.postMessage.mock.calls.at(-1)?.[0];
  if (!message || message.type !== 'calculate') throw new Error('Expected calculation request was not sent.');
  return message;
}

function t(key: TranslationKey, variables?: TranslationVariables): string {
  return translate(DEFAULT_LOCALE, key, variables);
}

function formatValue(value: number | null | undefined): string {
  if (typeof value !== 'number') throw new Error('Expected a numeric value.');
  return new Intl.NumberFormat(languageTags[DEFAULT_LOCALE], PROFILE_VALUE_FORMAT).format(value);
}

/** Readout shown for a selected residue, assembled from the same catalog entries as the component. */
function readout(row: ResiduePropensity | undefined, details: readonly string[]): string {
  if (!row) throw new Error('The selected residue has no propensities.');
  return [
    t('profile.readerName', { name: RESIDUE_NAMES[row.residue] ?? row.residue, position: row.position }),
    ...details,
    t('profile.readerPropensities', { helix: formatValue(row.helix), sheet: formatValue(row.sheet), turn: formatValue(row.turn) }),
  ].join(' · ');
}

function section(titleKey: TranslationKey): HTMLElement {
  return screen.getByRole('region', { name: spanish[titleKey] });
}

beforeEach(() => {
  vi.stubGlobal('Worker', MockWorker);
  Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', {
    configurable: true,
    value: vi.fn(() => ({ width: 0, height: 0 })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
  MockWorker.instance = null;
});

describe('accessible hydropathy profile', () => {
  it('transfers the canvas and tokens and warns when residues are missing', () => {
    const { rerender } = render(<HydropathyProfile text="ACDE" />);
    const worker = profileWorker();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const [start, transferables] = worker.postMessage.mock.calls[0] ?? [];
    expect(start?.type).toBe('initialize');
    expect(transferables).toHaveLength(1);
    expect(start && 'style' in start && start.style.font).toBeTruthy();
    expect(screen.getByText(t('profile.tooShort', { count: 9 }))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const shortRequest = lastRequest(worker);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: {
          id: shortRequest.id,
          points: [],
          propensities: calculatePropensities(shortRequest.sequence),
        },
      }));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(document.querySelector('canvas.hydropathy-chart')?.parentElement?.parentElement).toHaveAttribute('hidden');

    rerender(<HydropathyProfile text="ACDEFGHIKLMNPQRSTVWY" />);
    const chartContainer = document.querySelector('canvas.hydropathy-chart')?.parentElement?.parentElement;
    expect(chartContainer).not.toHaveAttribute('hidden');
    expect(chartContainer).toHaveClass('pending-chart');
    const request = lastRequest(worker);
    expect(request.windowSize).toBe(9);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: {
          id: request.id,
          points: calculateProfile(request.sequence, 9),
          propensities: calculatePropensities(request.sequence),
        },
      }));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.getByRole('columnheader', { name: spanish['profile.position'] })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: spanish['profile.turn'] })).toBeInTheDocument();
  });

  it('supports window 19, paginates values, and retains the profile for invalid input', () => {
    const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(6);
    const { rerender } = render(<HydropathyProfile text={sequence} />);
    const worker = profileWorker();
    fireEvent.click(screen.getByRole('radio', { name: '19' }));
    const request = lastRequest(worker);
    expect(request.windowSize).toBe(19);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: request.id, points: calculateProfile(sequence, 19), propensities: calculatePropensities(sequence) },
      }));
    });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(table.closest('details')?.querySelector('summary')).toHaveTextContent(spanish['profile.tableToggle']);
    expect(section('profile.tendencyTitle')).toContainElement(table);
    expect(section('profile.tendencyTitle')).not.toHaveClass('stale-table');
    expect(section('profile.readerTitle')).not.toHaveClass('stale-reader');
    expect(screen.getByText(t('profile.pageCount', { page: 1, total: 3 }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish['profile.next'] }));
    expect(screen.getByText(t('profile.pageCount', { page: 2, total: 3 }))).toBeInTheDocument();
    const messagesBefore = worker.postMessage.mock.calls.length;

    rerender(<HydropathyProfile text={`${sequence}-`} />);
    expect(worker.postMessage).toHaveBeenCalledTimes(messagesBefore);
    expect(within(section('profile.title')).getByRole('status')).toHaveTextContent(spanish['profile.invalid']);
    expect(section('profile.tendencyTitle')).toContainElement(screen.getByRole('table'));
    expect(section('profile.tendencyTitle')).toHaveClass('stale-table');
    expect(section('profile.readerTitle')).toHaveClass('stale-reader');
  });

  it('keeps the accessible table when canvas transfer is unavailable', () => {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
    render(<HydropathyProfile text="ACDEFGHIKLMNPQRSTVWY" />);
    const worker = profileWorker();
    const request = lastRequest(worker);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: {
          id: request.id,
          points: calculateProfile(request.sequence, 9),
          propensities: calculatePropensities(request.sequence),
        },
      }));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(within(section('profile.title')).getByRole('status')).toHaveTextContent(spanish['profile.unavailable']);
  });

  it('sends a fresh chart style when the theme changes', async () => {
    render(<HydropathyProfile text="ACDEFGHIKLMNPQRSTVWY" />);
    const worker = profileWorker();
    const originalCalls = worker.postMessage.mock.calls.length;
    act(() => { document.documentElement.dataset.theme = 'dark'; });
    await waitFor(() => { expect(worker.postMessage.mock.calls.length).toBeGreaterThan(originalCalls); });
    const message = worker.postMessage.mock.calls.at(-1)?.[0];
    expect(message?.type).toBe('redraw');
    expect(message && 'style' in message && message.style).toBeDefined();
    Reflect.deleteProperty(document.documentElement.dataset, 'theme');
  });

  it('redraws stale values after a theme change without calculating invalid input', async () => {
    const { rerender } = render(<HydropathyProfile text="ACDEFGHIKLMNPQRSTVWY" />);
    const worker = profileWorker();
    rerender(<HydropathyProfile text="ACDEFGHIKLMNPQRSTVWY-" />);
    const originalCalls = worker.postMessage.mock.calls.length;
    act(() => { document.documentElement.dataset.theme = 'dark'; });
    await waitFor(() => { expect(worker.postMessage.mock.calls.length).toBeGreaterThan(originalCalls); });
    expect(worker.postMessage.mock.calls.at(-1)?.[0].type).toBe('redraw');
    expect(worker.postMessage.mock.calls.slice(originalCalls).some(([message]) => message.type === 'calculate')).toBe(false);
    Reflect.deleteProperty(document.documentElement.dataset, 'theme');
  });

  it('links a selected residue to its averaged window and reads its values', () => {
    const sequence = 'ACDEFGHIKLMNPQRSTVWY';
    render(<HydropathyProfile text={sequence} />);
    const worker = profileWorker();
    const request = lastRequest(worker);
    const points = calculateProfile(sequence, 9);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: request.id, points, propensities: calculatePropensities(sequence) },
      }));
    });
    const propensities = calculatePropensities(sequence);
    const reader = screen.getByRole('group', { name: t('profile.readerLabel', { count: RESIDUES_PER_BLOCK }) });
    const display = document.getElementById('reader-readout');
    expect(section('profile.readerTitle')).toContainElement(reader);
    expect(section('profile.readerTitle')).toContainElement(display);
    expect(reader).toHaveAttribute('aria-describedby', 'reader-readout');
    expect(display).toHaveTextContent(spanish['profile.readerHint']);
    // Only the lines near the viewport are rendered; every rendered cell carries its chemistry and position.
    const cells = reader.querySelectorAll('.reader-residues > *');
    expect(cells).toHaveLength(RESIDUES_PER_BLOCK);
    expect(reader.querySelectorAll('span.residue[data-chem][data-position]')).toHaveLength(cells.length);
    fireEvent.click(within(reader).getByText('F'));
    const value = points.find((point) => point.position === 5)?.value ?? 0;
    expect(formatValue(value)).toBe(value.toFixed(3).replace('.', ','));
    expect(display?.textContent).toBe(readout(propensities[4], [t('profile.readerHydropathy', { value: formatValue(value), start: 1, end: 9 })]));
    expect(reader.querySelector('.residue.is-selected')).toHaveAttribute('data-position', '5');
    expect(reader.querySelector('.residue.is-selected')).toHaveAttribute('data-chem', 'hydrophobic');
    expect(reader.querySelectorAll('.in-window')).toHaveLength(8);
    fireEvent.keyDown(reader, { key: 'Home' });
    expect(display?.textContent).toBe(readout(propensities[0], [spanish['profile.readerNoWindow']]));
    expect(reader.querySelectorAll('.in-window')).toHaveLength(0);
  });

  it('follows a controlled selection and reads the region and bridge of an annotated reference', () => {
    const sequence = DEFAULT_EXAMPLE.text;
    const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
    if (!annotations) throw new Error('The bundled example has no annotations.');
    const onSelect = vi.fn<(position: number | null) => void>();
    const { rerender } = render(<HydropathyProfile text={sequence} selected={annotations.highlight} onSelect={onSelect} annotations={annotations} />);
    const worker = profileWorker();
    const request = lastRequest(worker);
    const points = calculateProfile(sequence, 9);
    const propensities = calculatePropensities(sequence);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', { data: { id: request.id, points, propensities } }));
    });
    const position = annotations.highlight;
    const value = points.find((point) => point.position === position)?.value;
    const display = document.getElementById('reader-readout');
    expect(display?.textContent).toBe(readout(propensities[position - 1], [
      t('profile.readerRegion', { region: spanish['regions.chainA'], index: 7 }),
      t('profile.readerBridge', { position: 31 }),
      t('profile.readerHydropathy', { value: formatValue(value), start: position - 4, end: position + 4 }),
    ]));
    const ribbon = screen.getByRole('img', { name: spanish['profile.mapLabel'] });
    expect(ribbon.querySelector('.is-selected')).toHaveAttribute('data-position', String(position));
    expect(ribbon.querySelector('[data-position="1"]')).toHaveClass('is-cut');
    expect(ribbon.querySelector(`[data-position="${String(position)}"]`)).not.toHaveClass('is-cut');
    const reader = screen.getByRole('group', { name: t('profile.readerLabel', { count: RESIDUES_PER_BLOCK }) });
    expect(reader.querySelector('[data-position="1"]')).toHaveClass('is-cut');

    fireEvent.keyDown(reader, { key: 'Home' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1);
    // The parent owns the selection: nothing moves until it passes the new position back.
    expect(ribbon.querySelector('.is-selected')).toHaveAttribute('data-position', String(position));
    expect(reader.querySelector('[data-position="1"]')).not.toHaveClass('is-selected');
    rerender(<HydropathyProfile text={sequence} selected={1} onSelect={onSelect} annotations={annotations} />);
    expect(reader.querySelector('[data-position="1"]')).toHaveClass('is-selected');
    expect(display?.textContent).toBe(readout(propensities[0], [
      t('profile.readerRegion', { region: spanish['regions.signal'], index: 1 }),
      spanish['profile.readerNoWindow'],
    ]));
  });
});
