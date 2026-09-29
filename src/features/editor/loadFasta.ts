import { AnalizadorFasta, type EntradaFasta } from './fasta';

/** Decodifica y analiza un flujo FASTA sin acumular el archivo completo. */
export async function cargarFasta(
  flujo: ReadableStream<Uint8Array>,
  publicar: (entradas: EntradaFasta[]) => void,
): Promise<void> {
  const lector = flujo.getReader();
  const decodificador = new TextDecoder('utf-8', { fatal: true });
  const analizador = new AnalizadorFasta();

  try {
    for (;;) {
      const bloque = await lector.read();
      if (bloque.done) break;
      const entradas = analizador.agregar(decodificador.decode(bloque.value, { stream: true }));
      if (entradas.length > 0) publicar(entradas);
    }
    const resto = decodificador.decode();
    if (resto) {
      const entradas = analizador.agregar(resto);
      if (entradas.length > 0) publicar(entradas);
    }
    const ultimas = analizador.finalizar();
    if (ultimas.length > 0) publicar(ultimas);
  } finally {
    lector.releaseLock();
  }
}
