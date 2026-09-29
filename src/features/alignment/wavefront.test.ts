import { describe, expect, it } from 'vitest';
import reference from './fixtures/biopython.json';
import { alignInTiles, MAX_ALIGNMENT_RESIDUES } from './wavefront';
import { alignSequences } from './gotoh';

describe('tiled wavefront', () => {
  it.each(reference.cases.filter((testCase) => testCase.freeEnds || testCase.mode === 'local'))(
    'matches the $name reference', async (testCase) => {
      const result = await alignInTiles(testCase.first, testCase.second, {
        matrix: testCase.matrix as 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80',
        mode: testCase.mode as 'global' | 'local',
      });
      expect(result.score).toBe(testCase.score);
      expect(result.alignedFirst).toBe(testCase.alignedFirst);
      expect(result.alignedSecond).toBe(testCase.alignedSecond);
    },
  );

  it('matches row scoring for all three matrices and both modes', async () => {
    const first = 'ACDEFGHIKLMNPQRSTVWY'.repeat(16);
    const second = `${'ACDEFGHIKLMNPQRSTVWY'.repeat(8)}X${'ACDEFGHIKLMNPQRSTVWY'.repeat(8)}`;
    for (const matrix of ['BLOSUM45', 'BLOSUM62', 'BLOSUM80'] as const) {
      for (const mode of ['global', 'local'] as const) {
        const row = await alignSequences(first, second, { matrix, mode });
        const tiles = await alignInTiles(first, second, { matrix, mode });
        expect(tiles.score).toBe(row.score);
      }
    }
  });

  it('reports progress and cancels between antidiagonals', async () => {
    let progress = 0;
    await expect(alignInTiles('A'.repeat(600), 'A'.repeat(600), {
      matrix: 'BLOSUM62', mode: 'global',
      onProgress: (fraction) => { progress = fraction; },
      isCancelled: () => progress > 0,
    })).rejects.toThrow(/cancelado/);
    expect(progress).toBeGreaterThan(0);
  });

  it('rejects overlong input before allocating the matrix', async () => {
    await expect(alignInTiles('A'.repeat(MAX_ALIGNMENT_RESIDUES + 1), 'A', {
      matrix: 'BLOSUM62', mode: 'global',
    })).rejects.toThrow(/máximo/);
  });
});
