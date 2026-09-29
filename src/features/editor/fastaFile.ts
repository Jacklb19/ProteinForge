import { z } from 'zod';

export const MAX_FASTA_BYTES = 5_000_000;

/** Validates file input before the worker reads it. */
export const fastaFileSchema = z.instanceof(File).refine(
  (file) => file.size <= MAX_FASTA_BYTES,
  'El archivo supera el límite de 5 MB.',
);
