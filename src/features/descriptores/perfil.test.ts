import { describe, expect, it } from 'vitest';
import referencia from './fixtures/protscale.json';
import { calcularPerfil } from './perfil';

describe('perfil de hidropatía Kyte–Doolittle', () => {
  it('coincide con ProtScale en valores y usa posiciones centrales de base uno', () => {
    const perfil = calcularPerfil(referencia.secuencia, 9);
    expect(perfil).toHaveLength(referencia.valores.length);
    for (const [indice, punto] of perfil.entries()) {
      expect(punto.posicion).toBe(indice + 5);
      expect(Math.abs((punto.valor ?? NaN) - (referencia.valores[indice] ?? NaN))).toBeLessThanOrEqual(0.001);
    }
  });

  it('requiere ventanas completas y admite secuencias más cortas', () => {
    expect(calcularPerfil('ACDEFGHI', 9)).toEqual([]);
    expect(calcularPerfil('ACDEFGHIKLMNPQRSTVW', 19)).toHaveLength(1);
    expect(calcularPerfil('ACDEFGHIKLMNPQRSTVWY', 19)[0]?.posicion).toBe(10);
  });

  it('rechaza caracteres inválidos y ventanas no autorizadas', () => {
    expect(() => calcularPerfil('AC-DEFGHI', 9)).toThrow(RangeError);
    expect(() => calcularPerfil('ACDEFGHIK', 11 as 9)).toThrow(RangeError);
  });

  it('conserva posiciones y marca sin dato las ventanas con letras adicionales', () => {
    const puntos = calcularPerfil('ACDEFGHIKXACDEFGHIK', 9);
    expect(puntos).toHaveLength(11);
    expect(puntos[0]?.valor).not.toBeNull();
    expect(puntos[1]?.valor).toBeNull();
    expect(puntos.at(-1)?.valor).not.toBeNull();
  });
});
