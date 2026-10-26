import { createHash } from 'node:crypto';
import type { SequenceSource } from '../features/editor/source';

/** Synthetic identities for lifecycle tests, independent from the public scientific fixtures. */
export const mappingReference: SequenceSource = { origin: 'catalog', accession: 'P01308', sequence: 'ACDEFG', sequenceVersion: 1, entryVersion: null, retrievedAt: null };
const residueAddress = { entityId: '1', labelAsymId: 'A', authAsymId: 'author-A', labelSeqId: 1, authSeqId: '-2', insertionCode: 'B' };
const residues = [residueAddress, { ...residueAddress, labelAsymId: 'B', authAsymId: 'author-B' }];
export const mappingAddress = { ...residueAddress, modelNum: 1 };
export const mappingCoordinates = residues.map(address => ({ ...address, modelNum: 1 }));
export function mappingEvidence() {
  return {
    reference_sequence_version: 1, reference_sequence_sha256: createHash('sha256').update(mappingReference.sequence).digest('hex'),
    mapping: { version: 1, pdbId: '1TRZ', provenance: { provider: 'PDBe/SIFTS', xmlUrl: 'https://example.org/sifts', residueListingUrl: 'https://example.org/residues', retrievedAt: '2026-10-25T15:00:00Z', releaseDate: '2026-10-18' }, rows: [
      ...residues.map(address => ({ ...address, segmentId: 'fragment', accession: 'P01308', position: 2, residue: 'C', notObserved: false })),
      { ...residueAddress, labelSeqId: 2, authSeqId: null, insertionCode: '', segmentId: 'fragment', accession: 'P01308', position: 3, residue: 'D', notObserved: true },
    ] },
  };
}
