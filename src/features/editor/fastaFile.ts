import { z } from 'zod';
import { translate } from '../../i18n/translate';
import { MAX_FASTA_BYTES, MAX_FASTA_MEGABYTES } from './config';
import { WORKER_LOCALE, languageTags } from '../../i18n/config';

export { MAX_FASTA_BYTES } from './config';

/** Validates file input before the worker reads it. */
export const fastaFileSchema = z.instanceof(File).refine(
  (file) => file.size <= MAX_FASTA_BYTES,
  translate(WORKER_LOCALE, 'errors.fastaLimit', { limit: new Intl.NumberFormat(languageTags[WORKER_LOCALE], { style: 'unit', unit: 'megabyte' }).format(MAX_FASTA_MEGABYTES) }),
);
