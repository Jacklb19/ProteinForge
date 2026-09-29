import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RespuestaPerfil, SolicitudPerfil } from './mensajesPerfil';
import { PerfilHidrofobicidad } from './PerfilHidrofobicidad';
import { calcularPerfil } from './perfil';
import { calcularPropensiones } from './chouFasman';

class WorkerSimulado {
  static instancia: WorkerSimulado | null = null;
  onmessage: ((evento: MessageEvent<RespuestaPerfil>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(mensaje: SolicitudPerfil, transferibles?: Transferable[]) => void>();
  terminate = vi.fn();
  constructor() { WorkerSimulado.instancia = this; }
}

function hiloPerfil(): WorkerSimulado {
  if (!WorkerSimulado.instancia) throw new Error('No se creó el Worker del perfil.');
  return WorkerSimulado.instancia;
}

function ultimaSolicitud(hilo: WorkerSimulado): Extract<SolicitudPerfil, { tipo: 'calcular' }> {
  const mensaje = hilo.postMessage.mock.calls.at(-1)?.[0];
  if (!mensaje || mensaje.tipo !== 'calcular') throw new Error('No se envió el cálculo esperado.');
  return mensaje;
}

beforeEach(() => {
  vi.stubGlobal('Worker', WorkerSimulado);
  Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', {
    configurable: true,
    value: vi.fn(() => ({ width: 0, height: 0 })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
  WorkerSimulado.instancia = null;
});

describe('perfil de hidrofobicidad accesible', () => {
  it('transfiere el lienzo y los tokens, y avisa si faltan residuos', () => {
    const { rerender } = render(<PerfilHidrofobicidad texto="ACDE" />);
    const hilo = hiloPerfil();
    expect(hilo.postMessage).toHaveBeenCalledTimes(2);
    const [inicio, transferibles] = hilo.postMessage.mock.calls[0] ?? [];
    expect(inicio?.tipo).toBe('iniciar');
    expect(transferibles).toHaveLength(1);
    expect(inicio && 'estilo' in inicio && inicio.estilo.fuente).toBeTruthy();
    expect(screen.getByText(/al menos 9 residuos/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const solicitudCorta = ultimaSolicitud(hilo);
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: {
          id: solicitudCorta.id,
          puntos: [],
          propensiones: calcularPropensiones(solicitudCorta.secuencia),
        },
      }));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(document.querySelector('canvas.grafica-hidrofobicidad')?.parentElement?.parentElement).toHaveAttribute('hidden');

    rerender(<PerfilHidrofobicidad texto="ACDEFGHIKLMNPQRSTVWY" />);
    const contenedorGrafica = document.querySelector('canvas.grafica-hidrofobicidad')?.parentElement?.parentElement;
    expect(contenedorGrafica).not.toHaveAttribute('hidden');
    expect(contenedorGrafica).toHaveClass('grafica-esperando');
    const solicitud = ultimaSolicitud(hilo);
    expect(solicitud.ventana).toBe(9);
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: {
          id: solicitud.id,
          puntos: calcularPerfil(solicitud.secuencia, 9),
          propensiones: calcularPropensiones(solicitud.secuencia),
        },
      }));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.getByRole('columnheader', { name: 'Posición' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giro' })).toBeInTheDocument();
  });

  it('permite 19 residuos, pagina todos los valores y conserva el perfil ante entradas inválidas', () => {
    const secuencia = 'ACDEFGHIKLMNPQRSTVWY'.repeat(6);
    const { rerender } = render(<PerfilHidrofobicidad texto={secuencia} />);
    const hilo = hiloPerfil();
    fireEvent.change(screen.getByRole('combobox', { name: /ventana de residuos/i }), { target: { value: '19' } });
    const solicitud = ultimaSolicitud(hilo);
    expect(solicitud.ventana).toBe(19);
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: { id: solicitud.id, puntos: calcularPerfil(secuencia, 19), propensiones: calcularPropensiones(secuencia) },
      }));
    });
    const tabla = screen.getByRole('table');
    expect(within(tabla).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText(/Página 1 de 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/Página 2 de 3/i)).toBeInTheDocument();
    const mensajesAntes = hilo.postMessage.mock.calls.length;

    rerender(<PerfilHidrofobicidad texto={`${secuencia}-`} />);
    expect(hilo.postMessage).toHaveBeenCalledTimes(mensajesAntes);
    expect(screen.getByText(/perfil y las propensiones están desactualizados/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('table').parentElement?.parentElement).toHaveClass('tabla-desactualizada');
  });

  it('mantiene la tabla accesible si no está disponible la transferencia del lienzo', () => {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
    render(<PerfilHidrofobicidad texto="ACDEFGHIKLMNPQRSTVWY" />);
    const hilo = hiloPerfil();
    const solicitud = ultimaSolicitud(hilo);
    act(() => {
      hilo.onmessage?.(new MessageEvent('message', {
        data: {
          id: solicitud.id,
          puntos: calcularPerfil(solicitud.secuencia, 9),
          propensiones: calcularPropensiones(solicitud.secuencia),
        },
      }));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/no permite transferir el lienzo/i)).toBeInTheDocument();
  });
});
