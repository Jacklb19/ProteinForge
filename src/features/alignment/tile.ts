import blosum from './fixtures/blosum.json';
import type { MatrixName, AlignmentMode } from './gotoh';

/** Boundary of the three Gotoh matrices for a tile row or column. */
export interface Boundary {
  m: Float32Array;
  x: Float32Array;
  y: Float32Array;
}

export interface TileRequest {
  row: number;
  column: number;
  height: number;
  width: number;
  first: string;
  second: string;
  matrix: MatrixName;
  mode: AlignmentMode;
  top: Boundary;
  left: Boundary;
  trace: ArrayBufferLike;
}

export interface TileResult {
  row: number;
  column: number;
  bottom: Boundary;
  right: Boundary;
  best: { score: number; i: number; j: number; state: number };
}

const ALPHABET = blosum.alphabet;

/** Calculates one tile once its top and left boundaries are known. */
export function calculateTile(request: TileRequest): TileResult {
  const { row, column, height, width, first, second, matrix, mode, top, left } = request;
  const trace = new Uint8Array(request.trace);
  const totalWidth = second.length + 1;
  let previousM = Float32Array.from(top.m);
  let previousX = Float32Array.from(top.x);
  let previousY = Float32Array.from(top.y);
  let currentM = new Float32Array(width + 1);
  let currentX = new Float32Array(width + 1);
  let currentY = new Float32Array(width + 1);
  const right: Boundary = {
    m: new Float32Array(height + 1),
    x: new Float32Array(height + 1),
    y: new Float32Array(height + 1),
  };
  right.m[0] = top.m[width] ?? 0;
  right.x[0] = top.x[width] ?? -Infinity;
  right.y[0] = top.y[width] ?? -Infinity;
  let best = { score: 0, i: 0, j: 0, state: 0 };
  const values = blosum.values[matrix];

  for (let localI = 1; localI <= height; localI += 1) {
    const i = row + localI;
    currentM[0] = left.m[localI] ?? 0;
    currentX[0] = left.x[localI] ?? -Infinity;
    currentY[0] = left.y[localI] ?? -Infinity;
    const scoreRow = values[ALPHABET.indexOf(first[i - 1] ?? '')] ?? [];
    for (let localJ = 1; localJ <= width; localJ += 1) {
      const j = column + localJ;
      let diagonal = previousM[localJ - 1] ?? -Infinity;
      let origin = 0;
      if ((previousX[localJ - 1] ?? -Infinity) > diagonal) {
        diagonal = previousX[localJ - 1] ?? -Infinity;
        origin = 1;
      }
      if ((previousY[localJ - 1] ?? -Infinity) > diagonal) {
        diagonal = previousY[localJ - 1] ?? -Infinity;
        origin = 2;
      }
      let m = diagonal + (scoreRow[ALPHABET.indexOf(second[j - 1] ?? '')] ?? -Infinity);
      if (mode === 'local' && m <= 0) {
        m = 0;
        origin = 3;
      }
      const openX = (previousM[localJ] ?? -Infinity) - 10;
      const extendX = (previousX[localJ] ?? -Infinity) - 0.5;
      const openY = (currentM[localJ - 1] ?? -Infinity) - 10;
      const extendY = (currentY[localJ - 1] ?? -Infinity) - 0.5;
      currentM[localJ] = m;
      currentX[localJ] = Math.max(openX, extendX);
      currentY[localJ] = Math.max(openY, extendY);
      trace[i * totalWidth + j] = origin | (extendX > openX ? 4 : 0) | (extendY > openY ? 8 : 0);
      if (mode === 'local' || i === first.length || j === second.length) {
        const candidates: [number, number][] = [[0, m], [1, currentX[localJ] ?? -Infinity], [2, currentY[localJ] ?? -Infinity]];
        for (const [state, score] of candidates) {
          if (score > best.score) best = { score, i, j, state };
        }
      }
    }
    right.m[localI] = currentM[width] ?? 0;
    right.x[localI] = currentX[width] ?? -Infinity;
    right.y[localI] = currentY[width] ?? -Infinity;
    [previousM, currentM] = [currentM, previousM];
    [previousX, currentX] = [currentX, previousX];
    [previousY, currentY] = [currentY, previousY];
  }
  return { row, column, bottom: { m: previousM, x: previousX, y: previousY }, right, best };
}

/** Initial boundaries for free global terminal gaps and local restarts. */
export function initialBoundary(length: number): Boundary {
  return {
    m: new Float32Array(length + 1),
    x: new Float32Array(length + 1).fill(Number.NEGATIVE_INFINITY),
    y: new Float32Array(length + 1).fill(Number.NEGATIVE_INFINITY),
  };
}
