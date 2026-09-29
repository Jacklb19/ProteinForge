import { initialBoundary, calculateTile } from './tile';
import type { TileResult, TileRequest } from './tile';
import { buildResult, normalizeForAlignment } from './gotoh';
import type { MatrixName, AlignmentMode, AlignmentResult } from './gotoh';

export const TILE_SIZE = 256;
export const MAX_ALIGNMENT_RESIDUES = 5000;

export interface WavefrontOptions {
  matrix: MatrixName;
  mode: AlignmentMode;
  onProgress?: (fraction: number) => void;
  isCancelled?: () => boolean;
  executeBatch?: (requests: TileRequest[]) => Promise<TileResult[]>;
  sharedMemory?: boolean;
}

/** Traverses tile antidiagonals and stores one traceback byte per cell. */
export async function alignInTiles(
  first: string,
  second: string,
  options: WavefrontOptions,
): Promise<AlignmentResult> {
  const a = normalizeForAlignment(first).sequence;
  const b = normalizeForAlignment(second).sequence;
  if (a.length > MAX_ALIGNMENT_RESIDUES || b.length > MAX_ALIGNMENT_RESIDUES) {
    throw new RangeError(`Cada secuencia admite como máximo ${String(MAX_ALIGNMENT_RESIDUES)} residuos.`);
  }
  const rows = Math.ceil(a.length / TILE_SIZE);
  const columns = Math.ceil(b.length / TILE_SIZE);
  const results: (TileResult | undefined)[][] = Array.from({ length: rows }, () => Array<TileResult | undefined>(columns));
  const traceLength = (a.length + 1) * (b.length + 1);
  const buffer = options.sharedMemory ? new SharedArrayBuffer(traceLength) : new ArrayBuffer(traceLength);
  const execute = options.executeBatch ?? ((requests: TileRequest[]) => Promise.resolve(requests.map(calculateTile)));
  let best = { score: 0, i: 0, j: options.mode === 'global' ? b.length : 0, state: 0 };
  let processed = 0;
  options.onProgress?.(0);

  for (let diagonal = 0; diagonal < rows + columns - 1; diagonal += 1) {
    const batch: TileRequest[] = [];
    for (let rowIndex = Math.max(0, diagonal - columns + 1); rowIndex <= Math.min(rows - 1, diagonal); rowIndex += 1) {
      const columnIndex = diagonal - rowIndex;
      const row = rowIndex * TILE_SIZE;
      const column = columnIndex * TILE_SIZE;
      const height = Math.min(TILE_SIZE, a.length - row);
      const width = Math.min(TILE_SIZE, b.length - column);
      const top = rowIndex === 0 ? initialBoundary(width) : results[rowIndex - 1]?.[columnIndex]?.bottom;
      const left = columnIndex === 0 ? initialBoundary(height) : results[rowIndex]?.[columnIndex - 1]?.right;
      if (!top || !left) throw new Error('Falta una frontera del frente de onda.');
      batch.push({ row, column, height, width, first: a, second: b, matrix: options.matrix,
        mode: options.mode, top, left, trace: buffer });
    }
    for (const result of await execute(batch)) {
      const rowIndex = Math.floor(result.row / TILE_SIZE);
      const columnIndex = Math.floor(result.column / TILE_SIZE);
      if (!results[rowIndex]) throw new Error('Índice de bloque fuera de rango.');
      results[rowIndex][columnIndex] = result;
      if (result.best.score > best.score) best = result.best;
      processed += Math.min(TILE_SIZE, a.length - result.row) * Math.min(TILE_SIZE, b.length - result.column);
    }
    options.onProgress?.(processed / (a.length * b.length));
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    if (options.isCancelled?.()) throw new Error('Alineamiento cancelado.');
  }
  return buildResult(a, b, options.matrix, options.mode, new Uint8Array(buffer), best);
}
