import { describe, expect, it } from 'vitest';
import { AnalizadorFasta } from './fasta';

describe('AnalizadorFasta', () => {
  it('lee varias entradas aunque el bloque corte una línea', () => {
    const analizador = new AnalizadorFasta();
    expect(analizador.agregar('>primera\nac\nd')).toEqual([]);
    expect(analizador.agregar('e\n>segunda anotación\nWXY\n')).toEqual([
      { numero: 1, encabezado: 'primera', secuencia: 'ACDE', posicionesInvalidas: [] },
    ]);
    expect(analizador.finalizar()).toEqual([
      { numero: 2, encabezado: 'segunda anotación', secuencia: 'WXY', posicionesInvalidas: [1] },
    ]);
  });

  it('rechaza contenido sin cabecera y entradas vacías', () => {
    expect(() => new AnalizadorFasta().agregar('AC\n')).toThrow(/cabecera FASTA/);
    const analizador = new AnalizadorFasta();
    analizador.agregar('>vacía\n');
    expect(() => analizador.finalizar()).toThrow(/no contiene secuencia/);
  });

  it('rechaza cabeceras vacías', () => {
    expect(() => new AnalizadorFasta().agregar('>\n')).toThrow(/cabecera.*vacía/);
  });

  it('tolera un salto CRLF dividido entre bloques', () => {
    const analizador = new AnalizadorFasta();
    analizador.agregar('>uno\r');
    analizador.agregar('\nAC\r');
    analizador.agregar('\n');
    expect(analizador.finalizar()[0]?.secuencia).toBe('AC');
  });

  it('conserva y señala residuos Unicode inválidos', () => {
    const analizador = new AnalizadorFasta();
    analizador.agregar('>uno\naıC\n');
    expect(analizador.finalizar()[0]).toMatchObject({
      secuencia: 'AıC',
      posicionesInvalidas: [1],
    });
  });
});
