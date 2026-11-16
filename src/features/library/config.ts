import type { TranslationKey } from '../../i18n';
import type { PdbReference } from './libraryApi';
export const UNIPROT_QUERY_MAX_LENGTH = 200;
export const UNIPROT_DEFAULT_QUERY = 'accession:P01308';
export const UNIPROT_URL = 'https://www.uniprot.org/uniprotkb/';
/** Structures whose chains get a concrete example in the help under the chain selector. */
export const CHAIN_HELP_EXAMPLES: readonly { accession: string; pdbId: string; text: TranslationKey }[] = [
  { accession: 'P01308', pdbId: '1TRZ', text: 'glossary.chainHelpInsulin' },
];
export const PDB_URL = 'https://www.rcsb.org/structure/';
/** The example the library opens on: human insulin and its experimental structure. */
export const INSULIN_ACCESSION = 'P01308';
export const INSULIN_STRUCTURE: PdbReference = { id: '1TRZ', method: 'X-ray', resolution: '1.60 Å', chains: 'A/C=90-110, B/D=25-54' };
/** The example's first copy of the A chain, so it opens on one residue instead of asking to choose between copies. */
export const INSULIN_CHAIN = 'A';
export const STRUCTURE_DOWNLOAD_URL = 'https://models.rcsb.org/';
/** Public SIFTS and PDBe documents the residue mapping reads from; `{id}` is the lower-case PDB identifier. */
export const SIFTS_XML_URL = 'https://ftp.ebi.ac.uk/pub/databases/msd/sifts/xml/{id}.xml.gz';
export const PDBE_RESIDUE_LISTING_URL = 'https://www.ebi.ac.uk/pdbe/api/pdb/entry/residue_listing/{id}';
export const SIFTS_NAMESPACE = 'http://www.ebi.ac.uk/pdbe/docs/sifts/eFamily.xsd';
export const STRUCTURE_TIMEOUT_MS = 20_000;
export const MAX_STRUCTURE_BYTES = 25_000_000;
/**
 * Chain colours of the experimental viewer, in order of appearance: the application's own tones, starting
 * with the two the backbone figure already uses for chains A and B. Further chains repeat the list.
 */
export const STRUCTURE_CHAIN_COLOR_TOKENS = ['--residue-hydrophobic', '--residue-basic', '--residue-polar', '--residue-special', '--residue-acidic', '--residue-cysteine'] as const;
export const CAMERA_ROTATION_RADIANS = Math.PI / 12;
export const CAMERA_ZOOM_FACTOR = 0.8;
