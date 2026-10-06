import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlignmentPage } from './AlignmentPage';
import type { AlignmentRequest, AlignmentResponse } from './messages';
import type { AlignmentResult } from './gotoh';

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

function enterSequences(first: string, second: string): void {
  fireEvent.change(screen.getByLabelText('Primera secuencia'), { target: { value: first } });
  fireEvent.change(screen.getByLabelText('Segunda secuencia'), { target: { value: second } });
}

beforeEach(() => {
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterEach(() => { vi.unstubAllGlobals(); MockWorker.instance = null; });

describe('alignment interface', () => {
  it('rejects empty, invalid, and overlong sequences without starting a worker task', () => {
    render(<AlignmentPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    expect(screen.getByRole('status')).toHaveTextContent('Escribe las dos secuencias');
    enterSequences('AC-', 'AC');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    expect(screen.getByRole('status')).toHaveTextContent('caracteres inválidos');
    enterSequences('A'.repeat(5001), 'AC');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    expect(screen.getByRole('status')).toHaveTextContent('5.000 residuos');
    expect(worker().postMessage).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'global', label: 'Global', ends: 'gratuitos', terminalGaps: 'free' },
    { mode: 'local', label: 'Local', ends: 'fuera del tramo', terminalGaps: 'not-applicable' },
  ] as const)('keeps exact $mode parameters, ignores old responses, and shows textual metrics', ({ mode, label, ends, terminalGaps }) => {
    render(<AlignmentPage />);
    enterSequences('ACDE*', 'ACDE');
    fireEvent.change(screen.getByLabelText('Matriz'), { target: { value: 'BLOSUM80' } });
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: mode } });
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    const request = worker().postMessage.mock.calls[0]?.[0];
    expect(request).toMatchObject({ type: 'start', first: 'ACDE', matrix: 'BLOSUM80', mode });
    if (!request) throw new Error('No task request was sent.');
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'result', id: request.id - 1, result } })); });
    expect(screen.queryByText('Resultado del alineamiento')).not.toBeInTheDocument();
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'progress', id: request.id, fraction: 0.5 } })); });
    expect(screen.getByRole('status')).toHaveTextContent('50 %');
    fireEvent.change(screen.getByLabelText('Matriz'), { target: { value: 'BLOSUM45' } });
    const storedResult: AlignmentResult = { ...result, parameters: { ...result.parameters, matrix: 'BLOSUM80', mode, terminalGaps } };
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'result', id: request.id, result: storedResult } })); });
    expect(screen.getByText('Identidad: 4 de 4 columnas (100 %).')).toBeInTheDocument();
    expect(screen.getByText('Similitud: 4 de 4 columnas (100 %).')).toBeInTheDocument();
    expect(screen.getByText(`Parámetros: BLOSUM80, modo ${label}, apertura 10, extensión 0,5, extremos ${ends}.`)).toBeInTheDocument();
  });

  it('warns for U and O and handles cancellation and worker failures', () => {
    render(<AlignmentPage />);
    enterSequences('UOBZX', 'CKBZX');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    expect(screen.getByText('U se puntúa como C.')).toBeInTheDocument();
    expect(screen.getByText('O se puntúa como K.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(worker().postMessage.mock.calls.at(-1)?.[0]).toEqual({ type: 'cancel', id: 1 });
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'cancelled', id: 1 } })); });
    expect(screen.getByRole('status')).toHaveTextContent('cancelado');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    act(() => { worker().onmessage?.(new MessageEvent('message', { data: { type: 'error', id: 2, message: 'Failure' } })); });
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo completar');
    act(() => { worker().onerror?.(); });
    expect(screen.getByRole('button', { name: 'Alinear' })).toBeEnabled();
  });

  it('reports unavailable worker support', async () => {
    vi.stubGlobal('Worker', vi.fn(function unavailableWorker() { throw new Error('Unavailable'); }));
    render(<AlignmentPage />);
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent('No se pudo iniciar'); });
    enterSequences('AC', 'AC');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear' }));
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo iniciar');
  });
});
