import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from '../editor/EditorPage';
import { calcularDescriptores } from './descriptors';
import type { RespuestaDescriptores, SolicitudDescriptores } from './messages';

class WorkerSimulado {
  static instancias: WorkerSimulado[] = [];
  ruta: string;
  onmessage: ((evento: MessageEvent<RespuestaDescriptores>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(mensaje: SolicitudDescriptores) => void>();
  terminate = vi.fn();

  constructor(ruta: URL | string) {
    this.ruta = String(ruta);
    WorkerSimulado.instancias.push(this);
  }
}

function hiloDescriptores(): WorkerSimulado {
  const hilo = WorkerSimulado.instancias.find((instancia) => instancia.ruta.includes('descriptors.worker'));
  if (!hilo) throw new Error('No se creó el Worker de descriptores.');
  return hilo;
}

function solicitudEn(hilo: WorkerSimulado, indice: number): SolicitudDescriptores {
  const solicitud = hilo.postMessage.mock.calls[indice]?.[0];
  if (!solicitud) throw new Error('Falta la solicitud esperada.');
  return solicitud;
}

afterEach(() => {
  vi.unstubAllGlobals();
  WorkerSimulado.instancias = [];
});

describe('descriptores en el editor', () => {
  it('conserva los últimos valores atenuados y no calcula una entrada inválida', () => {
    vi.stubGlobal('Worker', WorkerSimulado);
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'ACDE' } });
    const hilo = hiloDescriptores();
    expect(hilo.postMessage).toHaveBeenCalledTimes(1);
    const solicitud = solicitudEn(hilo, 0);
    expect(solicitud.secuencia).toBe('ACDE');
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: { id: solicitud.id, resultado: calcularDescriptores('ACDE') },
      }));
    });
    const panel = screen.getByRole('region', { name: /descriptores fisicoquímicos/i });
    expect(within(panel).getByText('Masa molecular')).toBeInTheDocument();
    const masaAnterior = within(panel).getByText(/Da$/).textContent;

    fireEvent.change(editor, { target: { value: 'AC-DE' } });
    expect(hilo.postMessage).toHaveBeenCalledTimes(1);
    expect(within(panel).getByText(/resultados están desactualizados/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Da$/).textContent).toBe(masaAnterior);
    expect(panel.querySelector('dl')).toHaveClass('descriptores-desactualizados');
  });

  it('excluye letras adicionales del cálculo y muestra su cantidad', () => {
    vi.stubGlobal('Worker', WorkerSimulado);
    render(<EditorPage />);
    fireEvent.change(screen.getByRole('textbox', { name: /secuencia de aminoácidos/i }), { target: { value: 'ACXDO' } });
    expect(solicitudEn(hiloDescriptores(), 0).secuencia).toBe('ACD');
    expect(screen.getByText(/2 residuos U, O, B, Z o X excluidos/i)).toBeInTheDocument();
  });

  it('ignora una respuesta anterior al último cambio válido', () => {
    vi.stubGlobal('Worker', WorkerSimulado);
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'ACDE' } });
    const hilo = hiloDescriptores();
    const primera = solicitudEn(hilo, 0);
    fireEvent.change(editor, { target: { value: 'ACDF' } });
    const segunda = solicitudEn(hilo, 1);
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: { id: primera.id, resultado: calcularDescriptores('ACDE') },
      }));
    });
    expect(screen.queryByText('Masa molecular')).not.toBeInTheDocument();
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: { id: segunda.id, resultado: calcularDescriptores('ACDF') },
      }));
    });
    expect(screen.getByText('Masa molecular')).toBeInTheDocument();
  });
});
