import { describe, expect, it } from 'vitest';
import { actualizarPosicionesInvalidas, validarSecuencia } from './secuencia';

describe('validarSecuencia', () => {
  it('acepta los veinte aminoácidos y convierte minúsculas', () => {
    expect(validarSecuencia('acdefghiklmnpqrstvwy')).toEqual({
      posicionesInvalidas: [],
      secuencia: 'ACDEFGHIKLMNPQRSTVWY',
    });
  });

  it('señala posiciones originales e ignora saltos de línea', () => {
    expect(validarSecuencia('AC\nBX-Z')).toEqual({
      posicionesInvalidas: [3, 4, 5, 6],
      secuencia: 'AC',
    });
  });

  it('revalida una edición local y desplaza errores posteriores', () => {
    expect(actualizarPosicionesInvalidas('AXZ', 'AC-Z', [1, 2])).toEqual([2, 3]);
    expect(actualizarPosicionesInvalidas('AC-Z', 'ACZ', [2, 3])).toEqual([2]);
  });
});
