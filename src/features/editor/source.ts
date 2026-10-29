import type { FastaEntry } from './fasta';

export type { SequenceSource } from './sourceSchema';
import type { SequenceSource } from './sourceSchema';

/** Use only with bundled UniProt fixtures, never to certify a user-supplied FASTA header. */
export function bundledSequenceSource(entry: FastaEntry): SequenceSource | null {
  const accession = entry.header.match(/^(?:sp|tr)\|([A-Z0-9]{6,10})\|/)?.[1];
  if (!accession) return null;
  const version = entry.header.match(/\bSV=(\d+)/)?.[1];
  return { origin: 'catalog', accession, sequence: entry.sequence, entryVersion: null, sequenceVersion: version ? Number(version) : null, retrievedAt: null };
}
