import { describe, expect, it } from 'vitest';
import { createResidueMapping as createMapping, residueMappingSchema } from './residueMapping';
import type { CoordinateResidue, ResidueMappingRow } from './residueMapping';

const reference = { accession: 'P01308', sequence: 'ACDEFG' };
const createResidueMapping = (document: unknown, reference: unknown, coordinates: unknown, modelNum: number) => createMapping(document, reference, { pdbId: '1TRZ', coordinates }, modelNum);
const row = (overrides: Partial<ResidueMappingRow> = {}): ResidueMappingRow => ({
  entityId: '1', labelAsymId: 'X', authAsymId: 'A', labelSeqId: 1, authSeqId: '-2', insertionCode: '',
  segmentId: 'fragment-1', accession: 'P01308', position: 2, residue: 'C', notObserved: false, ...overrides,
});
function document(rows: ResidueMappingRow[]) {
  return { version: 1, pdbId: '1TRZ', provenance: { provider: 'PDBe/SIFTS', xmlUrl: 'https://example.org/sifts', residueListingUrl: 'https://example.org/residues', retrievedAt: '2026-10-23T15:00:00Z', releaseDate: '2026-10-18' }, rows };
}
function coordinate(value = row(), modelNum = 1): CoordinateResidue {
  return { entityId: value.entityId, labelAsymId: value.labelAsymId, authAsymId: value.authAsymId, labelSeqId: value.labelSeqId, authSeqId: value.authSeqId, insertionCode: value.insertionCode, modelNum };
}

describe('explicit residue mapping', () => {
  it('round trips a fragment with distinct author and internal numbering, preserving insertions', () => {
    const insertion = row({ labelSeqId: 3, authSeqId: '-2', insertionCode: 'A', position: 5, residue: 'F', segmentId: 'fragment-2' });
    const mapping = createResidueMapping(document([row(), insertion]), reference, [coordinate(), coordinate(insertion)], 1);
    const selected = mapping.fromSequence(5);
    expect(selected.status).toBe('mapped');
    expect(selected.candidates[0]?.address).toEqual({ entityId: '1', labelAsymId: 'X', authAsymId: 'A', labelSeqId: 3, authSeqId: '-2', insertionCode: 'A' });
    expect(mapping.fromStructure(coordinate(insertion))).toMatchObject({ status: 'mapped', candidates: [{ position: 5 }] });
    expect(mapping.fromSequence(3).status).toBe('unmapped');
    expect(mapping.fromSequence(4).status).toBe('unmapped');
    expect(mapping.fromStructure({ ...coordinate(insertion), insertionCode: '' }).status).toBe('unmapped');
  });

  it('never interpolates uncovered ends, gaps or invalid positions', () => {
    const mapping = createResidueMapping(document([row()]), reference, [coordinate()], 1);
    for (const position of [-1, 0, 1, 3, 6, 7, 1.5, NaN]) expect(mapping.fromSequence(position).status).toBe('unmapped');
  });

  it('requires a chain to resolve copies, including a copy absent from the model', () => {
    const copy = row({ labelAsymId: 'Y', authAsymId: 'B' });
    const mapping = createResidueMapping(document([row(), copy]), reference, [coordinate()], 1);
    expect(mapping.fromSequence(2)).toMatchObject({ status: 'ambiguous', candidates: [{ observed: true }, { observed: false }] });
    expect(mapping.fromSequence(2, 'X').status).toBe('mapped');
    expect(mapping.fromSequence(2, 'Y').status).toBe('unobserved');
    expect(mapping.fromStructure(coordinate()).status).toBe('mapped');
    expect(mapping.fromStructure({ ...coordinate(), authAsymId: 'wrong' }).status).toBe('unmapped');
  });

  it('does not select coordinates from another model or an explicitly unobserved residue', () => {
    expect(createResidueMapping(document([row()]), reference, [coordinate(row(), 2)], 1).fromSequence(2).status).toBe('unobserved');
    expect(createResidueMapping(document([row({ notObserved: true })]), reference, [coordinate()], 1).fromSequence(2).status).toBe('unobserved');
    expect(createResidueMapping(document([row()]), reference, [coordinate()], 1).fromStructure(coordinate(row(), 2)).status).toBe('unmapped');
  });

  it('preserves isoforms and chimeric accessions without collapsing them into the canonical sequence', () => {
    const isoform = row({ accession: 'P01308-2', position: 3, residue: 'D' });
    expect(createResidueMapping(document([isoform]), reference, [coordinate()], 1).fromSequence(3).status).toBe('unmapped');
    const mapping = createResidueMapping(document([row(), isoform]), { ...reference, accession: 'P01308-2' }, [coordinate()], 1);
    expect(mapping.fromStructure(coordinate())).toMatchObject({ status: 'mapped', candidates: [{ accession: 'P01308-2', position: 3 }] });
  });

  it('reports conflicting correspondences in both directions instead of choosing the first row', () => {
    const conflict = row({ position: 3, residue: 'D' });
    const mapping = createResidueMapping(document([row(), conflict]), reference, [coordinate()], 1);
    expect(mapping.fromStructure(coordinate()).status).toBe('ambiguous');
    expect(mapping.fromSequence(2).status).toBe('ambiguous');
  });

  it('deduplicates overlaps without losing segment provenance or allowing mutation', () => {
    const mapping = createResidueMapping(document([row(), row(), row({ segmentId: 'overlap' })]), reference, [coordinate()], 1);
    const selected = mapping.fromSequence(2);
    expect(selected.status).toBe('mapped');
    expect(selected.candidates[0]?.segmentIds).toEqual(['fragment-1', 'overlap']);
    expect(Object.isFrozen(selected.candidates)).toBe(true);
    expect(Object.isFrozen(selected.candidates[0]?.address)).toBe(true);
    expect(() => createResidueMapping(document([row(), row({ notObserved: true })]), reference, [coordinate()], 1)).toThrow('Conflicting');
  });

  it('invalidates the entire binding for sequence mismatch, truncation or an out-of-date reference', () => {
    for (const sequence of ['AAAAAA', 'A']) {
      const mapping = createResidueMapping(document([row()]), { ...reference, sequence }, [coordinate()], 1);
      expect(mapping.fromSequence(2)).toEqual({ status: 'sequence-mismatch', candidates: [] });
      expect(mapping.fromStructure(coordinate())).toEqual({ status: 'sequence-mismatch', candidates: [] });
    }
  });

  it('rejects malformed documents and coordinate addresses at the boundary', () => {
    expect(() => residueMappingSchema.parse(document([row({ position: 0 })]))).toThrow();
    expect(() => residueMappingSchema.parse(document([row({ labelSeqId: -1 })]))).toThrow();
    expect(() => createResidueMapping(document([]), reference, [{ ...coordinate(), modelNum: 0 }], 1)).toThrow();
    expect(() => createResidueMapping(document([]), reference, [], 0)).toThrow();
    expect(() => createMapping(document([row()]), reference, { pdbId: '2XYZ', coordinates: [coordinate()] }, 1)).toThrow('different PDB entries');
    expect(() => residueMappingSchema.parse({ ...document([]), unexpected: true })).toThrow();
    expect(createResidueMapping(document([]), reference, [], 1).fromSequence(2)).toEqual({ status: 'unmapped', candidates: [] });
  });
});
