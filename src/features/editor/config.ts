import insulinFasta from '../descriptors/fixtures/P01308.fasta?raw';
import type { TranslationKey } from '../../i18n';

/** Router state that opens Analyze with project saving shown, for a sequence brought from another screen. */
export const OPEN_PROJECT_STATE = { panel: 'project' } as const;

/** Delay before revalidating the editor after typing stops. */
export const VALIDATION_DELAY_MS = 45;

/** Largest FASTA file read by the worker, in bytes (decimal megabytes for display). */
export const MAX_FASTA_BYTES = 5_000_000;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const MAX_FASTA_MEGABYTES = MAX_FASTA_BYTES / BYTES_PER_MEGABYTE;

/** File types offered by the FASTA picker. */
export const FASTA_ACCEPT = '.fa,.faa,.fasta,.fsa,text/plain';

/** Rows rendered beyond the FASTA list viewport, and rows rendered before the list is measured. */
export const FASTA_OVERSCAN_ROWS = 2;
export const FASTA_FALLBACK_VISIBLE_ROWS = 10;

/** Reference sequences offered when the editor is empty; data come from UniProt entries. */
export const EXAMPLE_SEQUENCES: readonly { accession: string; labelKey: TranslationKey; fasta: string }[] = [
  { accession: 'P01308', labelKey: 'examples.insulin', fasta: insulinFasta },
];
