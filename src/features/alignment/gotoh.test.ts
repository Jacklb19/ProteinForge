import { describe, expect, it } from 'vitest';
import reference from './fixtures/biopython.json';
import { alignSequences, tracebackMemoryBytes, normalizeForAlignment } from './gotoh';

describe('Gotoh with BLOSUM matrices', () => {
  it.each(reference.cases.filter((testCase) => testCase.freeEnds || testCase.mode === 'local'))(
    'matches Biopython 1.87 for $name ($matrix)',
    async (testCase) => {
      const result = await alignSequences(testCase.first, testCase.second, {
        matrix: testCase.matrix as 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80',
        mode: testCase.mode as 'global' | 'local',
      });
      expect(result.score).toBe(testCase.score);
      expect(result.alignedFirst).toBe(testCase.alignedFirst);
      expect(result.alignedSecond).toBe(testCase.alignedSecond);
    },
  );

  it('free terminal gaps change the score compared with penalized ends', async () => {
    const free = reference.cases.find((testCase) => testCase.name === 'free_ends' && testCase.freeEnds);
    const penalized = reference.cases.find((testCase) => testCase.name === 'free_ends' && !testCase.freeEnds);
    if (!free || !penalized) throw new Error('Both terminal gap fixtures are required.');
    expect((await alignSequences(free.first, free.second)).score).toBe(free.score);
    expect(free.score).toBeGreaterThan(penalized.score);
  });

  it('converts U and O and scores B, Z, and X directly', () => {
    expect(normalizeForAlignment('UOBZX')).toEqual({
      sequence: 'CKBZX',
      warnings: ['U se puntúa como C.', 'O se puntúa como K.'],
    });
    expect(() => normalizeForAlignment('AC-')).toThrow(RangeError);
  });

  it('measures traceback storage without quadratic score storage', () => {
    expect(tracebackMemoryBytes(2000, 2000)).toBe(2001 ** 2 + 6 * 2001 * 4);
    expect(tracebackMemoryBytes(5000, 5000)).toBe(5001 ** 2 + 6 * 5001 * 4);
    expect(tracebackMemoryBytes(10000, 10000)).toBe(10001 ** 2 + 6 * 10001 * 4);
  });
});
