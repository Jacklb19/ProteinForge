import { z } from 'zod';
import { MAX_PROJECT_SEQUENCE_LENGTH } from '../projects/config';
import type { FastaEntry } from './fasta';

/** Provenance belongs to an exact reference sequence; any manual edit clears it. */
export const sequenceSourceSchema = z.object({
  origin: z.enum(['catalog', 'uniprot']), accession: z.string().regex(/^[A-Z0-9]{6,10}$/),
  sequence: z.string().max(MAX_PROJECT_SEQUENCE_LENGTH).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]+$/),
  entryVersion: z.number().int().positive().nullable(), sequenceVersion: z.number().int().positive().nullable(),
  retrievedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type SequenceSource = z.infer<typeof sequenceSourceSchema>;

/** Use only with bundled UniProt fixtures, never to certify a user-supplied FASTA header. */
export function bundledSequenceSource(entry: FastaEntry): SequenceSource | null {
  const accession = entry.header.match(/^(?:sp|tr)\|([A-Z0-9]{6,10})\|/)?.[1];
  if (!accession) return null;
  const version = entry.header.match(/\bSV=(\d+)/)?.[1];
  return { origin: 'catalog', accession, sequence: entry.sequence, entryVersion: null, sequenceVersion: version ? Number(version) : null, retrievedAt: null };
}
