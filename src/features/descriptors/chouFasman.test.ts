import { describe, expect, it } from 'vitest';
import { calculatePropensities } from './chouFasman';

describe('ProtScale Chou–Fasman parameters', () => {
  it('returns helix, sheet, and turn for every residue including the ends', () => {
    expect(calculatePropensities('AVP')).toEqual([
      { position: 1, residue: 'A', helix: 1.42, sheet: 0.83, turn: 0.66 },
      { position: 2, residue: 'V', helix: 1.06, sheet: 1.70, turn: 0.50 },
      { position: 3, residue: 'P', helix: 0.57, sheet: 0.55, turn: 1.52 },
    ]);
  });

  it('rejects invalid characters without dropping positions', () => {
    expect(calculatePropensities('AXP')[1]).toEqual({ position: 2, residue: 'X', helix: null, sheet: null, turn: null });
    expect(() => calculatePropensities('A-P')).toThrow(RangeError);
    expect(() => calculatePropensities('')).toThrow(RangeError);
  });
});
