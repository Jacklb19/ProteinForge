import { z } from 'zod';
import { MAX_PROJECT_SEQUENCE_LENGTH } from '../projects/config';

/**
 * Validation of a sequence's provenance, apart from `source.ts` so that the bundled example the
 * application builds before its first render does not pull zod into the initial download. Only the
 * project contracts validate provenance, and they are read when a project is saved or opened.
 */

/** Provenance belongs to an exact reference sequence; any manual edit clears it. */
export const sequenceSourceSchema = z.object({
  origin: z.enum(['catalog', 'uniprot']), accession: z.string().regex(/^[A-Z0-9]{6,10}$/),
  sequence: z.string().max(MAX_PROJECT_SEQUENCE_LENGTH).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]+$/),
  entryVersion: z.number().int().positive().nullable(), sequenceVersion: z.number().int().positive().nullable(),
  retrievedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type SequenceSource = z.infer<typeof sequenceSourceSchema>;
