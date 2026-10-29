import type { Locale } from '../../i18n';

/** A source as it was fetched: its address, licence and the digest of the saved response. */
export interface DomainSource {
  name: string;
  licence: string;
  licenceUrl: string;
  url: string;
  retrievedAt: string;
  sha256: string;
}

/** One documented part: an exact stretch of a reviewed UniProt entry, with what supports it. */
export interface DomainEntry {
  id: string;
  kind: string;
  accession: string;
  entryName: string;
  entryVersion: number;
  sequenceVersion: number;
  protein: string;
  gene: string;
  organism: string;
  taxonId: number;
  feature: { type: string; description: string | null; start: number; end: number; evidence: string[] };
  sequence: string;
  sequenceSha256: string;
  family: { database: string; accession: string; name: string; start: number; end: number } | null;
  structure: { pdb: string; method: string; resolutionAngstrom: number | null; chains: string; start: number; end: number } | null;
  summary: Record<Locale, string>;
  sources: DomainSource[];
}

export interface DomainCatalog {
  schemaVersion: number;
  summaryNote: Record<Locale, string>;
  domains: DomainEntry[];
}

/** The catalogue is loaded only when its tab opens, so it never weighs on the first load or on Library. */
export async function loadDomainCatalog(): Promise<DomainCatalog> {
  const module = await import('./catalog.json');
  return module.default;
}
