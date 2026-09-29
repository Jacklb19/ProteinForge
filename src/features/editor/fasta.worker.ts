/// <reference lib="webworker" />
import { cargarFasta } from './cargarFasta';
import { esquemaArchivoFasta } from './archivoFasta';

self.onmessage = async (evento: MessageEvent<unknown>): Promise<void> => {
  const resultado = esquemaArchivoFasta.safeParse(evento.data);
  if (!resultado.success) {
    self.postMessage({ tipo: 'error', mensaje: resultado.error.issues[0]?.message ?? 'Archivo FASTA inválido.' });
    return;
  }

  try {
    await cargarFasta(resultado.data.stream(), (entradas) => {
      self.postMessage({ tipo: 'entradas', entradas });
    });
    self.postMessage({ tipo: 'completo' });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo leer el archivo FASTA.';
    self.postMessage({ tipo: 'error', mensaje });
  }
};
