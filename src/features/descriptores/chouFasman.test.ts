import { describe, expect, it } from 'vitest';
import { calcularPropensiones } from './chouFasman';

describe('parámetros Chou–Fasman de ProtScale', () => {
  it('devuelve hélice, lámina y giro para cada residuo, incluidos los extremos', () => {
    expect(calcularPropensiones('AVP')).toEqual([
      { posicion: 1, residuo: 'A', helice: 1.42, lamina: 0.83, giro: 0.66 },
      { posicion: 2, residuo: 'V', helice: 1.06, lamina: 1.70, giro: 0.50 },
      { posicion: 3, residuo: 'P', helice: 0.57, lamina: 0.55, giro: 1.52 },
    ]);
  });

  it('rechaza caracteres inválidos sin omitir posiciones', () => {
    expect(() => calcularPropensiones('AXP')).toThrow(RangeError);
    expect(() => calcularPropensiones('')).toThrow(RangeError);
  });
});
