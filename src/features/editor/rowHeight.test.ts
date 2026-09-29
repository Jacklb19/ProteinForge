import { describe, expect, it } from 'vitest';
import { resolverAlturaFila } from './rowHeight';

describe('resolverAlturaFila', () => {
  it.each(['0px', 'NaN', ''])('usa el token de respaldo si la altura CSS es %s', (valor) => {
    expect(resolverAlturaFila(valor, '44px')).toEqual({
      pixeles: 44,
      respaldoDeEmergencia: false,
    });
  });

  it('mantiene una altura positiva si tampoco existe el token de respaldo', () => {
    expect(resolverAlturaFila('', '')).toEqual({
      pixeles: 1,
      respaldoDeEmergencia: true,
    });
  });
});
