import { z } from 'zod';
import { translate } from '../../i18n/translate';

export const MAX_FASTA_BYTES = 5_000_000;

/** Validates file input before the worker reads it. */
export const fastaFileSchema = z.instanceof(File).refine(
  (file) => file.size <= MAX_FASTA_BYTES,
  translate('es', 'errors.fastaLimit'),
);
