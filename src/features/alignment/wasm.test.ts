import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import init, { calculate_tile } from '../../../rust/alignment/pkg/proteinforge_alignment';
import reference from './fixtures/biopython.json';
import { calculateWasmTile } from './wasm';
import { alignInTiles } from './wavefront';
import { calculateTile } from './tile';
import type { TileRequest } from './tile';

beforeAll(async () => {
  await init({ module_or_path: await readFile('rust/alignment/pkg/proteinforge_alignment_bg.wasm') });
});

const executeBatch = (tiles: TileRequest[]) => Promise.resolve(tiles.map(calculateWasmTile));

describe('WebAssembly alignment kernel', () => {
  it.each(reference.cases.filter((item) => item.freeEnds || item.mode === 'local'))(
    'matches Biopython for $name ($matrix)', async (item) => {
      const result = await alignInTiles(item.first, item.second, {
        matrix: item.matrix as 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80',
        mode: item.mode as 'global' | 'local', executeBatch,
      });
      expect(result.score).toBe(item.score);
      expect(result.alignedFirst).toBe(item.alignedFirst);
      expect(result.alignedSecond).toBe(item.alignedSecond);
    },
  );

  it('matches every boundary and traceback byte across partial tiles', async () => {
    const first = 'ACDEFGHIKLMNPQRSTVWYBZX'.repeat(26);
    const second = `${first.slice(0, 251)}WWWW${first.slice(267)}`;
    for (const matrix of ['BLOSUM45', 'BLOSUM62', 'BLOSUM80'] as const) {
      for (const mode of ['global', 'local'] as const) {
        await alignInTiles(first, second, { matrix, mode, executeBatch: (tiles) => Promise.resolve(tiles.map((tile) => {
          const comparison = { ...tile, trace: tile.trace.slice(0) };
          const expected = calculateTile(comparison);
          const actual = calculateWasmTile(tile);
          expect(actual).toEqual(expected);
          expect(Buffer.compare(Buffer.from(tile.trace), Buffer.from(comparison.trace))).toBe(0);
          return actual;
        })) });
      }
    }
  });

  it('rejects malformed input at the WASM boundary', () => {
    expect(() => calculate_tile(new Uint8Array([255]), new Uint8Array([0]), new Float32Array([4]), 1,
      new Float32Array(6), new Float32Array(6), false, true, true)).toThrow(/Invalid/);
  });

  it('cancels the WASM path between antidiagonals', async () => {
    let progress = 0;
    await expect(alignInTiles('A'.repeat(600), 'A'.repeat(600), {
      matrix: 'BLOSUM62', mode: 'global', executeBatch,
      onProgress: (value) => { progress = value; }, isCancelled: () => progress > 0,
    })).rejects.toThrow(/cancelado/);
  });
});
