import { describe, expect, it, vi } from 'vitest';
import { dibujarPerfil, referenciasParaVentana } from './drawProfile';
import type { EstiloGrafica } from './profileMessages';

const estilo: EstiloGrafica = {
  superficie: 'white', texto: 'black', curva: 'blue', referencia: 'gray',
  fuente: '14px sans-serif', margen: 36, trazo: 2, trazoReferencia: 1,
};

describe('trazado del perfil', () => {
  it('incluye cero y el umbral transmembrana solo con ventana 19', () => {
    expect(referenciasParaVentana(9)).toEqual([0]);
    expect(referenciasParaVentana(19)).toEqual([0, 1.6]);
  });

  it('dibuja las dos referencias y el perfil con los estilos enviados', () => {
    const contexto = {
      setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn<(texto: string, x: number, y: number) => void>(),
      arc: vi.fn(), fill: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
    };
    const lienzo = { width: 0, height: 0, getContext: vi.fn(() => contexto) } as unknown as OffscreenCanvas;
    dibujarPerfil(lienzo, [{ posicion: 10, valor: 0.3 }, { posicion: 11, valor: 1.8 }], 19, 400, 200, 2, estilo);
    expect(lienzo.width).toBe(800);
    expect(lienzo.height).toBe(400);
    expect(contexto.fillText.mock.calls.map((llamada) => llamada[0])).toContain('1,6');
    expect(contexto.fillText.mock.calls.map((llamada) => llamada[0])).toContain('0');
    expect(contexto.strokeStyle).toBe(estilo.curva);
    expect(contexto.font).toBe(estilo.fuente);
  });
});
