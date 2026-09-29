import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstiloGrafica, RespuestaPerfil, SolicitudPerfil } from './mensajesPerfil';

interface ContextoSimulado {
  onmessage: ((evento: MessageEvent<SolicitudPerfil>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

const estilo: EstiloGrafica = {
  superficie: 'white', texto: 'black', curva: 'blue', referencia: 'gray',
  fuente: '14px sans-serif', margen: 36, trazo: 2, trazoReferencia: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Worker del perfil', () => {
  it('recibe el lienzo y devuelve los puntos completos', async () => {
    const contexto: ContextoSimulado = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal('self', contexto);
    await import('./perfil.worker');
    const dibujo = {
      setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
    };
    const lienzo = { width: 0, height: 0, getContext: vi.fn(() => dibujo) } as unknown as OffscreenCanvas;
    contexto.onmessage?.(new MessageEvent('message', { data: { tipo: 'iniciar', lienzo, estilo } }));
    contexto.onmessage?.(new MessageEvent('message', {
      data: {
        tipo: 'calcular', id: 7, secuencia: 'ACDEFGHIK', ventana: 9,
        ancho: 400, alto: 200, escala: 1, estilo,
      },
    }));
    const respuesta = contexto.postMessage.mock.calls[0]?.[0] as RespuestaPerfil;
    expect(respuesta.id).toBe(7);
    expect(respuesta.puntos).toHaveLength(1);
    expect(respuesta.puntos?.[0]?.posicion).toBe(5);
    expect(dibujo.strokeStyle).toBe('blue');
  });
});
