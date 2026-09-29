import { describe, expect, it } from 'vitest';
import { cargarFasta } from './cargarFasta';
import type { EntradaFasta } from './fasta';

function flujoDe(bloques: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controlador) {
      for (const bloque of bloques) controlador.enqueue(bloque);
      controlador.close();
    },
  });
}

describe('cargarFasta', () => {
  it('publica entradas conforme llegan sin esperar el archivo completo', async () => {
    const codificador = new TextEncoder();
    const publicadas: EntradaFasta[][] = [];
    await cargarFasta(flujoDe([
      codificador.encode('>uno\nAC\n>dos\n'),
      codificador.encode('DE'),
    ]), (entradas) => { publicadas.push(entradas); });
    expect(publicadas).toHaveLength(2);
    expect(publicadas[0]?.[0]?.secuencia).toBe('AC');
    expect(publicadas[1]?.[0]?.secuencia).toBe('DE');
  });

  it('rechaza bytes que no sean UTF-8 válido', async () => {
    await expect(cargarFasta(flujoDe([new Uint8Array([0xff])]), () => {})).rejects.toThrow();
  });
});
