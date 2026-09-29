import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import { HydropathyProfile } from './HydropathyProfile';
import { calculateProfile } from './profile';
import { calculatePropensities } from './chouFasman';

class MockWorker {
  static instance: MockWorker | null = null;
  onmessage: ((event: MessageEvent<ProfileResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(message: ProfileRequest, transferables?: Transferable[]) => void>();
  terminate = vi.fn();
  constructor() { MockWorker.instance = this; }
}

function profileWorker(): MockWorker {
  if (!MockWorker.instance) throw new Error('No se creó el Worker del perfil.');
  return MockWorker.instance;
}

function lastRequest(worker: MockWorker): Extract<ProfileRequest, { type: 'calculate' }> {
  const message = worker.postMessage.mock.calls.at(-1)?.[0];
  if (!message || message.type !== 'calculate') throw new Error('Expected calculation request was not sent.');
  return message;
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
    expect(screen.getByText(/al menos 9 residuos/i)).toBeInTheDocument();
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
    expect(screen.getByRole('columnheader', { name: 'Posición' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giro' })).toBeInTheDocument();
  });

  it('supports window 19, paginates values, and retains the profile for invalid input', () => {
    const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(6);
    const { rerender } = render(<HydropathyProfile text={sequence} />);
    const worker = profileWorker();
    fireEvent.change(screen.getByRole('combobox', { name: /ventana de residuos/i }), { target: { value: '19' } });
    const request = lastRequest(worker);
    expect(request.windowSize).toBe(19);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: request.id, points: calculateProfile(sequence, 19), propensities: calculatePropensities(sequence) },
      }));
    });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText(/Página 1 de 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/Página 2 de 3/i)).toBeInTheDocument();
    const messagesBefore = worker.postMessage.mock.calls.length;

    rerender(<HydropathyProfile text={`${sequence}-`} />);
    expect(worker.postMessage).toHaveBeenCalledTimes(messagesBefore);
    expect(screen.getByText(/perfil y las propensiones están desactualizados/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('table').parentElement?.parentElement).toHaveClass('stale-table');
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
    expect(screen.getByText(/no permite transferir el lienzo/i)).toBeInTheDocument();
  });
});
