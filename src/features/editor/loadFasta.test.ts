import { describe, expect, it } from 'vitest';
import { cargarFasta } from './loadFasta';
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

  it('analiza por bloques un FASTA de 5 MB con múltiples entradas', async () => {
    const base = Array.from({ length: 1000 }, (_, indice) =>
      `>entrada ${String(indice + 1)}\n${'ACDE'.repeat(1240)}\n`).join('');
    const cabeceraFinal = '>ultima\n';
    const contenido = base + cabeceraFinal + 'A'.repeat(5_000_000 - base.length - cabeceraFinal.length);
    const bytes = new TextEncoder().encode(contenido);
    const bloques: Uint8Array[] = [];
    for (let indice = 0; indice < bytes.length; indice += 65_536) {
      bloques.push(bytes.slice(indice, indice + 65_536));
    }
    let cantidad = 0;
    await cargarFasta(flujoDe(bloques), (entradas) => { cantidad += entradas.length; });
    expect(bytes.length).toBe(5_000_000);
    expect(cantidad).toBe(1001);
  });
});
