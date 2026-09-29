import { describe, expect, it } from 'vitest';
import referencia from './fixtures/biopython.json';
import { alinearSecuencias, memoriaCaminoVuelta, normalizarParaAlineamiento } from './gotoh';

describe('Gotoh con matrices BLOSUM', () => {
  it.each(referencia.casos.filter((caso) => caso.extremosLibres || caso.modo === 'local'))(
    'coincide con Biopython 1.87 en $nombre ($matriz)',
    async (caso) => {
      const resultado = await alinearSecuencias(caso.primera, caso.segunda, {
        matriz: caso.matriz as 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80',
        modo: caso.modo as 'global' | 'local',
      });
      expect(resultado.puntuacion).toBe(caso.puntuacion);
      expect(resultado.primeraAlineada).toBe(caso.primeraAlineada);
      expect(resultado.segundaAlineada).toBe(caso.segundaAlineada);
    },
  );

  it('los extremos libres alteran la puntuación respecto a penalizarlos', async () => {
    const libre = referencia.casos.find((caso) => caso.nombre === 'extremos_libres' && caso.extremosLibres);
    const penalizado = referencia.casos.find((caso) => caso.nombre === 'extremos_libres' && !caso.extremosLibres);
    if (!libre || !penalizado) throw new Error('Faltan los dos fixtures de extremos.');
    expect((await alinearSecuencias(libre.primera, libre.segunda)).puntuacion).toBe(libre.puntuacion);
    expect(libre.puntuacion).toBeGreaterThan(penalizado.puntuacion);
  });

  it('convierte U y O, y puntúa B, Z y X directamente', () => {
    expect(normalizarParaAlineamiento('UOBZX')).toEqual({
      secuencia: 'CKBZX',
      avisos: ['U se puntúa como C.', 'O se puntúa como K.'],
    });
    expect(() => normalizarParaAlineamiento('AC-')).toThrow(RangeError);
  });

  it('calcula el tamaño del traceback sin reserva cuadrática de puntuaciones', () => {
    expect(memoriaCaminoVuelta(2000, 2000)).toBe(2001 ** 2 + 6 * 2001 * 4);
    expect(memoriaCaminoVuelta(5000, 5000)).toBe(5001 ** 2 + 6 * 5001 * 4);
    expect(memoriaCaminoVuelta(10000, 10000)).toBe(10001 ** 2 + 6 * 10001 * 4);
  });
});
