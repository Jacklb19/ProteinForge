import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import referencias from './fixtures/protparam.json';
import { calcularDescriptores } from './descriptores';

function leerSecuencia(accession: string): string {
  return readFileSync(resolve('src/features/descriptores/fixtures', `${accession}.fasta`), 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .join('')
    .trim();
}

describe('descriptores fisicoquímicos frente a ProtParam', () => {
  for (const referencia of referencias) {
    it(`${referencia.accession}: cinco descriptores de ${String(referencia.longitud)} residuos`, () => {
      const resultado = calcularDescriptores(leerSecuencia(referencia.accession));
      expect(resultado.longitud).toBe(referencia.longitud);
      expect(Math.abs(resultado.masaDa - referencia.masaDa)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(resultado.puntoIsoelectrico - referencia.puntoIsoelectrico)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(resultado.indiceInestabilidad - referencia.indiceInestabilidad)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(resultado.indiceAlifatico - referencia.indiceAlifatico)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(resultado.gravy - referencia.gravy)).toBeLessThanOrEqual(0.01);
    });
  }

  it('rechaza cadenas vacías y caracteres inválidos sin descartarlos', () => {
    expect(() => calcularDescriptores('')).toThrow(RangeError);
    expect(() => calcularDescriptores('ACXDE')).toThrow(RangeError);
    expect(() => calcularDescriptores('acde')).toThrow(RangeError);
  });
});
