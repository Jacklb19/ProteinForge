import { describe, expect, it } from 'vitest';
import referencia from './fixtures/biopython.json';
import { alinearPorBloques, MAX_RESIDUOS_ALINEAMIENTO } from './frenteOnda';
import { alinearSecuencias } from './gotoh';

describe('frente de onda por bloques', () => {
  it.each(referencia.casos.filter((caso) => caso.extremosLibres || caso.modo === 'local'))(
    'reproduce el oráculo $nombre', async (caso) => {
      const resultado = await alinearPorBloques(caso.primera, caso.segunda, {
        matriz: caso.matriz as 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80',
        modo: caso.modo as 'global' | 'local',
      });
      expect(resultado.puntuacion).toBe(caso.puntuacion);
      expect(resultado.primeraAlineada).toBe(caso.primeraAlineada);
      expect(resultado.segundaAlineada).toBe(caso.segundaAlineada);
    },
  );

  it('coincide entre bloques en las tres matrices y ambos modos', async () => {
    const primera = 'ACDEFGHIKLMNPQRSTVWY'.repeat(16);
    const segunda = `${'ACDEFGHIKLMNPQRSTVWY'.repeat(8)}X${'ACDEFGHIKLMNPQRSTVWY'.repeat(8)}`;
    for (const matriz of ['BLOSUM45', 'BLOSUM62', 'BLOSUM80'] as const) {
      for (const modo of ['global', 'local'] as const) {
        const fila = await alinearSecuencias(primera, segunda, { matriz, modo });
        const bloques = await alinearPorBloques(primera, segunda, { matriz, modo });
        expect(bloques.puntuacion).toBe(fila.puntuacion);
      }
    }
  });

  it('informa avance y permite cancelar entre antidiagonales', async () => {
    let avance = 0;
    await expect(alinearPorBloques('A'.repeat(600), 'A'.repeat(600), {
      matriz: 'BLOSUM62', modo: 'global',
      progreso: (fraccion) => { avance = fraccion; },
      cancelado: () => avance > 0,
    })).rejects.toThrow(/cancelado/);
    expect(avance).toBeGreaterThan(0);
  });

  it('rechaza entradas que superan el límite antes de reservar la matriz', async () => {
    await expect(alinearPorBloques('A'.repeat(MAX_RESIDUOS_ALINEAMIENTO + 1), 'A', {
      matriz: 'BLOSUM62', modo: 'global',
    })).rejects.toThrow(/máximo/);
  });
});
