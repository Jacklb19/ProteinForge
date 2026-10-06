import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from './EditorPage';
import type { FastaEntry } from './fasta';

type WorkerMessage =
  | { type: 'entries'; entries: FastaEntry[] }
  | { type: 'complete' }
  | { type: 'error'; message: string };

function setupWorker(): Array<{
  path: string;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}> {
  const instances: Array<{
    path: string;
    onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }> = [];
  class MockWorker {
    path: string;
    onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(path: URL | string) { this.path = String(path); instances.push(this); }
  }
  vi.stubGlobal('Worker', MockWorker);
  return instances;
}

function fastaWorker(instances: ReturnType<typeof setupWorker>) {
  return instances.find((instance) => instance.path.includes('fasta.worker'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--height-fasta-row');
  document.documentElement.style.removeProperty('--height-fasta-row-default');
});

describe('FastaLoader', () => {
  it('waits for pending fonts before measuring virtualized rows', async () => {
    let completeFonts: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => { completeFonts = resolve; });
    const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });
    const measured = vi.fn();
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('fasta-entry')) measured();
      return { x: 0, y: 0, top: 0, left: 0, bottom: 44, right: 200, width: 200, height: 44, toJSON: () => ({}) };
    });
    try {
      const instances = setupWorker();
      render(<EditorPage />);
      fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
        target: { files: [new File(['>entry\nAC'], 'entry.fa')] },
      });
      act(() => { fastaWorker(instances)?.onmessage?.(new MessageEvent('message', { data: {
        type: 'entries', entries: [{ number: 1, header: 'entry', sequence: 'AC', invalidPositions: [] }],
      } })); });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(measured).not.toHaveBeenCalled();
      await act(async () => { completeFonts?.(); await ready; });
      expect(measured).toHaveBeenCalledOnce();
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
      expect(screen.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue('AC');
    } finally {
      bounds.mockRestore();
      if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
      else Reflect.deleteProperty(document, 'fonts');
    }
  });
  it('receives worker entries and supports keyboard selection', () => {
    const instances = setupWorker();
    render(<EditorPage />);
    const file = new File(['>uno\nAC\n>dos\nDE'], 'prueba.fa');
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), { target: { files: [file] } });
    const worker = fastaWorker(instances);
    expect(worker).toBeDefined();
    expect(worker?.postMessage).toHaveBeenCalledWith(file);
    act(() => {
      worker?.onmessage?.(new MessageEvent('message', { data: { type: 'entries', entries: [
        { number: 1, header: 'uno', sequence: 'AC', invalidPositions: [] },
        { number: 2, header: 'dos', sequence: 'DE', invalidPositions: [] },
      ] } }));
      worker?.onmessage?.(new MessageEvent('message', { data: { type: 'complete' } }));
    });
    const list = screen.getByRole('listbox', { name: /entradas FASTA/i });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue('DE');
    expect(screen.getByRole('option', { name: /dos/i })).toHaveAttribute('aria-selected', 'true');
    expect(worker?.terminate).toHaveBeenCalled();
  });

  it('bounds the number of rendered options', () => {
    const instances = setupWorker();
    render(<EditorPage />);
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
      target: { files: [new File(['>uno\nAC'], 'muchas.fa')] },
    });
    const worker = fastaWorker(instances);
    const entries = Array.from({ length: 1000 }, (_, index) => ({
      number: index + 1,
      header: `entrada ${String(index + 1)}`,
      sequence: 'AC',
      invalidPositions: [],
    }));
    act(() => {
      worker?.onmessage?.(new MessageEvent('message', { data: { type: 'entries', entries: entries } }));
    });
    expect(within(screen.getByRole('listbox', { name: /entradas FASTA/i })).getAllByRole('option').length).toBeLessThan(20);
    expect(screen.getByText(/1\.000 entradas encontradas/i)).toBeInTheDocument();
  });

  it.each([
    ['0px', '44px', '44px'],
    ['NaN', '44px', '44px'],
    ['', '44px', '44px'],
    ['', '', '1px'],
  ])('bounds options with CSS height %s and fallback %s', (value, fallback, expected) => {
    document.documentElement.style.setProperty('--height-fasta-row', value);
    document.documentElement.style.setProperty('--height-fasta-row-default', fallback);
    const instances = setupWorker();
    render(<EditorPage />);
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
      target: { files: [new File(['>uno\nAC'], 'altura.fa')] },
    });
    const entries = Array.from({ length: 1000 }, (_, index) => ({
      number: index + 1,
      header: `entrada ${String(index + 1)}`,
      sequence: 'AC',
      invalidPositions: [],
    }));
    act(() => {
      fastaWorker(instances)?.onmessage?.(new MessageEvent('message', { data: { type: 'entries', entries: entries } }));
    });
    const list = screen.getByRole('listbox', { name: /entradas FASTA/i });
    expect(list.style.getPropertyValue('--height-fasta-row-effective')).toBe(expected);
    expect(within(list).getAllByRole('option').length).toBeLessThanOrEqual(10);
  });

  it('reports worker errors explicitly', () => {
    const instances = setupWorker();
    render(<EditorPage />);
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
      target: { files: [new File(['texto'], 'mal.fa')] },
    });
    const worker = fastaWorker(instances);
    act(() => {
      worker?.onmessage?.(new MessageEvent('message', { data: { type: 'error', message: 'Formato inválido.' } }));
    });
    expect(screen.getByText(/Error: Formato inválido/i)).toBeInTheDocument();
  });
});
