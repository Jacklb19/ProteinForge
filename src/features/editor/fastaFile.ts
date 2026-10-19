import { z } from 'zod';
import { MAX_FASTA_BYTES, MAX_FASTA_MEGABYTES } from './config';
import type { LocalizedText } from '../../i18n/localized';

export { MAX_FASTA_BYTES } from './config';

/** Validates file input before the worker reads it. */
export const fastaFileSchema = z.instanceof(File).refine((file) => file.size <= MAX_FASTA_BYTES);

/** Why an input cannot be read: too large, or not a file at all. */
export function fastaInputProblem(input: unknown): LocalizedText {
  return input instanceof File ? { key: 'errors.fastaLimit', variables: { limit: MAX_FASTA_MEGABYTES } } : { key: 'errors.invalidFasta' };
}
