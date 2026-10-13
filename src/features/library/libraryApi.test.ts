import { describe, expect, it } from 'vitest';
import { annotatedCoverage, entrySchema } from './libraryApi';
import { REFERENCE_CATALOG } from './catalog';
import { validateSequence } from '../editor/sequence';

describe('reference integrity', () => {
  it('keeps full versioned references valid and identifiable by canonical accession', () => {
    expect(REFERENCE_CATALOG.map((entry) => entry.accession)).toEqual(['P01308', 'P01317', 'P00698', 'P13569']);
    for (const reference of REFERENCE_CATALOG) expect(validateSequence(reference.sequence).invalidPositions).toEqual([]);
    expect(REFERENCE_CATALOG.map((entry) => entry.sequence.length)).toEqual([110, 105, 147, 1480]);
  });
  it('counts unique annotation positions across duplicate chains without claiming coordinates', () => {
    expect(annotatedCoverage('A/C=90-110, B/D=25-54', 110)).toBe(51);
    expect(annotatedCoverage('A=1-10, B=5-15', 20)).toBe(15);
    expect(annotatedCoverage('A=1-200', 110)).toBeNull();
    expect(annotatedCoverage('A=?', 110)).toBeNull();
    expect(annotatedCoverage(null, 110)).toBeNull();
  });
  it('rejects inconsistent sequence lengths and untrusted PDB identifiers at the boundary', () => {
    const record = { accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', length: 3, reviewed: true, sequence: 'ACD', entryVersion: 284, sequenceVersion: 1, retrievedAt: '2026-10-12T08:00:00Z', function: null, structures: [{ id: '1TRZ', method: 'X-ray', resolution: '1.60 A', chains: 'A=1-3' }] };
    expect(entrySchema.safeParse(record).success).toBe(true);
    expect(entrySchema.safeParse({ ...record, sequence: 'AC' }).success).toBe(false);
    expect(entrySchema.safeParse({ ...record, structures: [{ ...record.structures[0], id: '../../private' }] }).success).toBe(false);
  });
});
