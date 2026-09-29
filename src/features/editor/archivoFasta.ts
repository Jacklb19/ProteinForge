import { z } from 'zod';

export const TAMANO_MAXIMO_FASTA = 5_000_000;

/** Comprueba la frontera de carga antes de leer un archivo en el Worker. */
export const esquemaArchivoFasta = z.instanceof(File).refine(
  (archivo) => archivo.size <= TAMANO_MAXIMO_FASTA,
  'El archivo supera el límite de 5 MB.',
);
