import type { TranslationKey } from '../../i18n';

/** Query parameter holding the UniProt accession on screen, so a protein can be linked. */
export const EXPLORE_PARAM = 'protein';
/** Bundled reference the page opens with: a small enzyme with catalytic residues and four bonds. */
export const EXPLORE_DEFAULT_ACCESSION = 'P00698';

/** AlphaFold Protein Structure Database: public predicted models, one request per accession. */
export const ALPHAFOLD_API_URL = 'https://alphafold.ebi.ac.uk/api/prediction/';
export const ALPHAFOLD_FILES_URL = 'https://alphafold.ebi.ac.uk/files/';
export const ALPHAFOLD_ENTRY_URL = 'https://alphafold.ebi.ac.uk/entry/';
export const MODEL_LOOKUP_TIMEOUT_MS = 12_000;

/** Mean pLDDT thresholds as AlphaFold DB words them: very high, confident, low and very low. */
export const CONFIDENCE_BANDS: readonly { from: number; key: TranslationKey }[] = [
  { from: 90, key: 'explore.confidenceVeryHigh' },
  { from: 70, key: 'explore.confidenceHigh' },
  { from: 50, key: 'explore.confidenceLow' },
  { from: 0, key: 'explore.confidenceVeryLow' },
];

/** Kinds of positional annotation the reference service returns, as the page understands them. */
export const STOP_KINDS = [
  'active-site', 'binding-site', 'site', 'dna-binding', 'zinc-finger', 'motif',
  'domain', 'region', 'transmembrane', 'signal', 'transit-peptide', 'propeptide', 'chain', 'peptide',
  'disulfide', 'modified-residue', 'glycosylation', 'variant',
] as const;
export type StopKind = (typeof STOP_KINDS)[number];

/** The tour reads in this order: what the protein does, how it is built, how it is modified, how it varies. */
export const STOP_GROUPS = ['function', 'architecture', 'chemistry', 'variants'] as const;
export type StopGroup = (typeof STOP_GROUPS)[number];
export const STOP_GROUP_OF: Readonly<Record<StopKind, StopGroup>> = {
  'active-site': 'function', 'binding-site': 'function', site: 'function', 'dna-binding': 'function', 'zinc-finger': 'function', motif: 'function',
  domain: 'architecture', region: 'architecture', transmembrane: 'architecture', signal: 'architecture', 'transit-peptide': 'architecture',
  propeptide: 'architecture', chain: 'architecture', peptide: 'architecture',
  disulfide: 'chemistry', 'modified-residue': 'chemistry', glycosylation: 'chemistry',
  variant: 'variants',
};
export const STOP_GROUP_LABEL_KEYS = {
  function: 'explore.groupFunction', architecture: 'explore.groupArchitecture', chemistry: 'explore.groupChemistry', variants: 'explore.groupVariants',
} as const satisfies Record<StopGroup, TranslationKey>;
export const STOP_KIND_LABEL_KEYS = {
  'active-site': 'explore.kindActiveSite', 'binding-site': 'explore.kindBindingSite', site: 'explore.kindSite', 'dna-binding': 'explore.kindDnaBinding',
  'zinc-finger': 'explore.kindZincFinger', motif: 'explore.kindMotif', domain: 'explore.kindDomain', region: 'explore.kindRegion',
  transmembrane: 'explore.kindTransmembrane', signal: 'explore.kindSignal', 'transit-peptide': 'explore.kindTransitPeptide', propeptide: 'explore.kindPropeptide',
  chain: 'explore.kindChain', peptide: 'explore.kindPeptide', disulfide: 'explore.kindDisulfide', 'modified-residue': 'explore.kindModifiedResidue',
  glycosylation: 'explore.kindGlycosylation', variant: 'explore.kindVariant',
} as const satisfies Record<StopKind, TranslationKey>;
/** What each kind of annotation means, in plain words. */
export const STOP_KIND_MEANING_KEYS = {
  'active-site': 'explore.meansActiveSite', 'binding-site': 'explore.meansBindingSite', site: 'explore.meansSite', 'dna-binding': 'explore.meansDnaBinding',
  'zinc-finger': 'explore.meansZincFinger', motif: 'explore.meansMotif', domain: 'explore.meansDomain', region: 'explore.meansRegion',
  transmembrane: 'explore.meansTransmembrane', signal: 'explore.meansSignal', 'transit-peptide': 'explore.meansTransitPeptide', propeptide: 'explore.meansPropeptide',
  chain: 'explore.meansChain', peptide: 'explore.meansPeptide', disulfide: 'explore.meansDisulfide', 'modified-residue': 'explore.meansModifiedResidue',
  glycosylation: 'explore.meansGlycosylation', variant: 'explore.meansVariant',
} as const satisfies Record<StopKind, TranslationKey>;

/** Stops of at most this many residues also draw their side chains; longer ones are marked on the ribbon only. */
export const FOCUS_STICKS_MAX_RESIDUES = 12;
/** Stops listed per group before «Show all»: a long entry stays scannable, and the tour still visits every stop. */
export const STOP_GROUP_PREVIEW = 6;
/** Function texts longer than this open folded, with a control to read the rest. */
export const FUNCTION_PREVIEW_CHARACTERS = 360;
/** Literature references inside UniProt's free text, such as «(PubMed:12345, PubMed:67890)». */
export const PUBMED_CITATION = /\s*\((?:PubMed:\d+(?:,\s*)?)+\)/g;
/** Camera travel to a stop; none with reduced motion. */
export const FOCUS_CAMERA_MS = 450;
/** Tokens the viewer reads for what is not residue chemistry: the mark of the stop on screen and unclassified residues. */
export const FOCUS_MARK_TOKEN = '--text-primary';
export const UNCLASSIFIED_RESIDUE_TOKEN = '--text-secondary';
/** Name under which the residue-chemistry colouring is registered in the viewer. */
export const CHEMISTRY_THEME_NAME = 'proteinforge-chemistry';
