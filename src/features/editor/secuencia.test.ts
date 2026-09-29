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
      posicionesInvalidas: [5],
      secuencia: 'ACBXZ',
    });
  });

  it('rechaza letras Unicode que se convierten en residuos ASCII al pasar a mayúsculas', () => {
    expect(validarSecuencia('AıC').posicionesInvalidas).toEqual([1]);
  });

  it('revalida una edición local y desplaza errores posteriores', () => {
    expect(actualizarPosicionesInvalidas('A-Z', 'AC-Z', [1])).toEqual([2]);
    expect(actualizarPosicionesInvalidas('AC-Z', 'ACZ', [2])).toEqual([]);
  });

  it('conserva U, O, B, Z y X, y retira únicamente un asterisco terminal', () => {
    expect(validarSecuencia('aubzx*\n')).toEqual({ posicionesInvalidas: [], secuencia: 'AUBZX' });
    expect(validarSecuencia('AC*DE').posicionesInvalidas).toEqual([2]);
  });
});
