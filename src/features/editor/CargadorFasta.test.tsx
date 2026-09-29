import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from './EditorPage';
import type { EntradaFasta } from './fasta';

type Mensaje =
  | { tipo: 'entradas'; entradas: EntradaFasta[] }
  | { tipo: 'completo' }
  | { tipo: 'error'; mensaje: string };

function prepararHilo(): Array<{
  ruta: string;
  onmessage: ((evento: MessageEvent<Mensaje>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}> {
  const instancias: Array<{
    ruta: string;
    onmessage: ((evento: MessageEvent<Mensaje>) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }> = [];
  class WorkerSimulado {
    ruta: string;
    onmessage: ((evento: MessageEvent<Mensaje>) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(ruta: URL | string) { this.ruta = String(ruta); instancias.push(this); }
  }
  vi.stubGlobal('Worker', WorkerSimulado);
  return instancias;
}

function hiloFasta(instancias: ReturnType<typeof prepararHilo>) {
  return instancias.find((instancia) => instancia.ruta.includes('fasta.worker'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--height-fasta-row');
  document.documentElement.style.removeProperty('--height-fasta-row-default');
});

describe('CargadorFasta', () => {
  it('recibe entradas del Worker y permite elegir una con teclado', () => {
    const instancias = prepararHilo();
    render(<EditorPage />);
    const archivo = new File(['>uno\nAC\n>dos\nDE'], 'prueba.fa');
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), { target: { files: [archivo] } });
    const hilo = hiloFasta(instancias);
    expect(hilo).toBeDefined();
    expect(hilo?.postMessage).toHaveBeenCalledWith(archivo);
    act(() => {
      hilo?.onmessage?.(new MessageEvent('message', { data: { tipo: 'entradas', entradas: [
        { numero: 1, encabezado: 'uno', secuencia: 'AC', posicionesInvalidas: [] },
        { numero: 2, encabezado: 'dos', secuencia: 'DE', posicionesInvalidas: [] },
      ] } }));
      hilo?.onmessage?.(new MessageEvent('message', { data: { tipo: 'completo' } }));
    });
    const lista = screen.getByRole('listbox', { name: /entradas FASTA/i });
    fireEvent.keyDown(lista, { key: 'ArrowDown' });
    fireEvent.keyDown(lista, { key: 'ArrowDown' });
    expect(screen.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue('DE');
    expect(screen.getByRole('option', { name: /dos/i })).toHaveAttribute('aria-selected', 'true');
    expect(hilo?.terminate).toHaveBeenCalled();
  });

  it('mantiene acotado el número de opciones renderizadas', () => {
    const instancias = prepararHilo();
    render(<EditorPage />);
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
      target: { files: [new File(['>uno\nAC'], 'muchas.fa')] },
    });
    const hilo = hiloFasta(instancias);
    const entradas = Array.from({ length: 1000 }, (_, indice) => ({
      numero: indice + 1,
      encabezado: `entrada ${String(indice + 1)}`,
      secuencia: 'AC',
      posicionesInvalidas: [],
    }));
    act(() => {
      hilo?.onmessage?.(new MessageEvent('message', { data: { tipo: 'entradas', entradas } }));
    });
    expect(within(screen.getByRole('listbox', { name: /entradas FASTA/i })).getAllByRole('option').length).toBeLessThan(20);
    expect(screen.getByText(/1000 entradas encontradas/i)).toBeInTheDocument();
  });

  it.each([
    ['0px', '44px', '44px'],
    ['NaN', '44px', '44px'],
    ['', '44px', '44px'],
    ['', '', '1px'],
  ])('limita las opciones con altura CSS %s y respaldo %s', (valor, respaldo, esperado) => {
    document.documentElement.style.setProperty('--height-fasta-row', valor);
    document.documentElement.style.setProperty('--height-fasta-row-default', respaldo);
    const instancias = prepararHilo();
    render(<EditorPage />);
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
      target: { files: [new File(['>uno\nAC'], 'altura.fa')] },
    });
    const entradas = Array.from({ length: 1000 }, (_, indice) => ({
      numero: indice + 1,
      encabezado: `entrada ${String(indice + 1)}`,
      secuencia: 'AC',
      posicionesInvalidas: [],
    }));
    act(() => {
      hiloFasta(instancias)?.onmessage?.(new MessageEvent('message', { data: { tipo: 'entradas', entradas } }));
    });
    const lista = screen.getByRole('listbox', { name: /entradas FASTA/i });
    expect(lista.style.getPropertyValue('--height-fasta-row-effective')).toBe(esperado);
    expect(within(lista).getAllByRole('option').length).toBeLessThanOrEqual(10);
  });

  it('muestra explícitamente los errores del Worker', () => {
    const instancias = prepararHilo();
    render(<EditorPage />);
    fireEvent.change(screen.getByLabelText(/archivo FASTA de hasta/i), {
      target: { files: [new File(['texto'], 'mal.fa')] },
    });
    const hilo = hiloFasta(instancias);
    act(() => {
      hilo?.onmessage?.(new MessageEvent('message', { data: { tipo: 'error', mensaje: 'Formato inválido.' } }));
    });
    expect(screen.getByText(/Error: Formato inválido/i)).toBeInTheDocument();
  });
});
