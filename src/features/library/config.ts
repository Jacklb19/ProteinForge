import type { TranslationKey } from '../../i18n';
export const UNIPROT_QUERY_MAX_LENGTH = 200;
export const UNIPROT_DEFAULT_QUERY = 'accession:P01308';
export const UNIPROT_URL = 'https://www.uniprot.org/uniprotkb/';
/** Structures whose chains get a concrete example in the help under the chain selector. */
export const CHAIN_HELP_EXAMPLES: readonly { accession: string; pdbId: string; text: TranslationKey }[] = [
  { accession: 'P01308', pdbId: '1TRZ', text: 'glossary.chainHelpInsulin' },
];
export const PDB_URL = 'https://www.rcsb.org/structure/';
export const STRUCTURE_DOWNLOAD_URL = 'https://models.rcsb.org/';
export const STRUCTURE_TIMEOUT_MS = 20_000;
export const MAX_STRUCTURE_BYTES = 25_000_000;
/**
 * Chain colours of the experimental viewer, in order of appearance: the application's own tones, starting
 * with the two the backbone figure already uses for chains A and B. Further chains repeat the list.
 */
export const STRUCTURE_CHAIN_COLOR_TOKENS = ['--residue-hydrophobic', '--residue-basic', '--residue-polar', '--residue-special', '--residue-acidic', '--residue-cysteine'] as const;
export const CAMERA_ROTATION_RADIANS = Math.PI / 12;
export const CAMERA_ZOOM_FACTOR = 0.8;
