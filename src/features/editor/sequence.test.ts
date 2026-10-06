import { describe, expect, it } from 'vitest';
import { updateInvalidPositions, validateSequence } from './sequence';

describe('validateSequence', () => {
  it('accepts the twenty amino acids and uppercases lowercase letters', () => {
    expect(validateSequence('acdefghiklmnpqrstvwy')).toEqual({
      invalidPositions: [],
      sequence: 'ACDEFGHIKLMNPQRSTVWY',
    });
  });

  it('reports original positions and ignores line breaks', () => {
    expect(validateSequence('AC\nBX-Z')).toEqual({
      invalidPositions: [5],
      sequence: 'ACBXZ',
    });
  });

  it('rejects Unicode letters whose uppercase form is an ASCII residue', () => {
    expect(validateSequence('AıC').invalidPositions).toEqual([1]);
  });

  it('revalidates a local edit and shifts later errors', () => {
    expect(updateInvalidPositions('A-Z', 'AC-Z', [1])).toEqual([2]);
    expect(updateInvalidPositions('AC-Z', 'ACZ', [2])).toEqual([]);
  });

  it('retains U, O, B, Z, and X while removing only a terminal asterisk', () => {
    expect(validateSequence('aubzx*\n')).toEqual({ invalidPositions: [], sequence: 'AUBZX' });
    expect(validateSequence('AC*DE').invalidPositions).toEqual([2]);
  });
});
