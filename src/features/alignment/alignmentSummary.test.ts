import { describe, expect, it } from 'vitest';
import { countGapColumns, isStaleResult } from './alignmentSummary';
import { DEFAULT_MATRIX, DEFAULT_MODE } from './config';

describe('alignment summary', () => {
  it('counts columns with a gap in either sequence', () => {
    expect(countGapColumns({ alignedFirst: 'AC-DE', alignedSecond: 'ACG-E' })).toBe(2);
    expect(countGapColumns({ alignedFirst: 'ACDE', alignedSecond: 'ACDE' })).toBe(0);
  });

  it('marks a result stale when any input or parameter differs', () => {
    const input = { first: 'ACDE', second: 'ACDF', matrix: DEFAULT_MATRIX, mode: DEFAULT_MODE };
    expect(isStaleResult(null, input)).toBe(false);
    expect(isStaleResult(input, { ...input })).toBe(false);
    expect(isStaleResult(input, { ...input, second: 'ACDE' })).toBe(true);
    expect(isStaleResult(input, { ...input, matrix: 'BLOSUM80' })).toBe(true);
    expect(isStaleResult(input, { ...input, mode: 'local' })).toBe(true);
  });
});
