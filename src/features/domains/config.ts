import type { TranslationKey } from '../../i18n';

export const DOMAINS_CONFIG = {
  /** Longest text the catalogue search accepts. */
  queryMaxLength: 60,
  /** Residues per FASTA line, the usual width of UniProt downloads. */
  fastaLineWidth: 60,
  /** Neutral identifier of the joined record; the provenance of each part follows it. */
  fastaRecord: 'proteinforge-assembly',
  filename: 'proteinforge-assembly.fasta',
  downloadRevokeMs: 1000,
} as const;

/** Labels for the kinds the catalogue groups its parts by; an unknown kind falls back to its own code. */
export const DOMAIN_KIND_LABELS: Readonly<Record<string, TranslationKey>> = {
  sh3: 'domains.kindSh3', sh2: 'domains.kindSh2', kinase: 'domains.kindKinase', pdz: 'domains.kindPdz',
  ww: 'domains.kindWw', ppiase: 'domains.kindPpiase', c2h2: 'domains.kindC2h2', ig: 'domains.kindIg',
  fn3: 'domains.kindFn3', ubl: 'domains.kindUbl', efhand: 'domains.kindEfhand', bzip: 'domains.kindBzip',
  tm: 'domains.kindTm', signal: 'domains.kindSignal', ph: 'domains.kindPh', homeobox: 'domains.kindHomeobox',
  kringle: 'domains.kindKringle', egf: 'domains.kindEgf', death: 'domains.kindDeath', bromo: 'domains.kindBromo',
  chromo: 'domains.kindChromo', rrm: 'domains.kindRrm', thioredoxin: 'domains.kindThioredoxin',
  cadherin: 'domains.kindCadherin', lysozyme: 'domains.kindLysozyme',
};

/** Source names are stored as gathered; the interface names them in the active language. */
export const DOMAIN_SOURCE_LABELS: Readonly<Record<string, TranslationKey>> = {
  UniProtKB: 'domains.sourceUniprot',
  'InterPro (Pfam)': 'domains.sourceInterpro',
  'PDB (vía SIFTS en UniProt)': 'domains.sourcePdb',
};
