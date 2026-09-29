import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from '../editor/EditorPage';
import { calculateDescriptors } from './descriptors';
import type { DescriptorResponse, DescriptorRequest } from './messages';

class MockWorker {
  static instancias: MockWorker[] = [];
  ruta: string;
  onmessage: ((event: MessageEvent<DescriptorResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(message: DescriptorRequest) => void>();
  terminate = vi.fn();

  constructor(ruta: URL | string) {
    this.ruta = String(ruta);
    MockWorker.instancias.push(this);
  }
}

function descriptorWorker(): MockWorker {
  const worker = MockWorker.instancias.find((instance) => instance.ruta.includes('descriptors.worker'));
  if (!worker) throw new Error('No se creó el Worker de descriptores.');
  return worker;
}

function requestAt(worker: MockWorker, index: number): DescriptorRequest {
  const request = worker.postMessage.mock.calls[index]?.[0];
  if (!request) throw new Error('Falta la solicitud esperada.');
  return request;
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockWorker.instancias = [];
});

describe('descriptors in the editor', () => {
  it('keeps prior values faded and does not calculate invalid input', () => {
    vi.stubGlobal('Worker', MockWorker);
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'ACDE' } });
    const worker = descriptorWorker();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const request = requestAt(worker, 0);
    expect(request.sequence).toBe('ACDE');
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: request.id, result: calculateDescriptors('ACDE') },
      }));
    });
    const panel = screen.getByRole('region', { name: /descriptores fisicoquímicos/i });
    expect(within(panel).getByText('Masa molecular')).toBeInTheDocument();
    const previousMass = within(panel).getByText(/Da$/).textContent;

    fireEvent.change(editor, { target: { value: 'AC-DE' } });
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(within(panel).getByText(/resultados están desactualizados/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Da$/).textContent).toBe(previousMass);
    expect(panel.querySelector('dl')).toHaveClass('descriptores-desactualizados');
  });

  it('excludes additional residues and shows their count', () => {
    vi.stubGlobal('Worker', MockWorker);
    render(<EditorPage />);
    fireEvent.change(screen.getByRole('textbox', { name: /secuencia de aminoácidos/i }), { target: { value: 'ACXDO' } });
    expect(requestAt(descriptorWorker(), 0).sequence).toBe('ACD');
    expect(screen.getByText(/2 residuos U, O, B, Z o X excluidos/i)).toBeInTheDocument();
  });

  it('ignores a response older than the latest valid edit', () => {
    vi.stubGlobal('Worker', MockWorker);
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'ACDE' } });
    const worker = descriptorWorker();
    const first = requestAt(worker, 0);
    fireEvent.change(editor, { target: { value: 'ACDF' } });
    const segunda = requestAt(worker, 1);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: first.id, result: calculateDescriptors('ACDE') },
      }));
    });
    expect(screen.queryByText('Masa molecular')).not.toBeInTheDocument();
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: segunda.id, result: calculateDescriptors('ACDF') },
      }));
    });
    expect(screen.getByText('Masa molecular')).toBeInTheDocument();
  });
});
