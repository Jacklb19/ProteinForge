import init, { calculate_tile } from '../../../rust/alignment/pkg/proteinforge_alignment';
import blosum from './fixtures/blosum.json';
import type { Boundary, TileRequest, TileResult } from './tile';

let initialization: Promise<unknown> | undefined;

/** Initializes one private WASM instance per Worker; failures reach the caller. */
export function initializeAlignmentWasm(): Promise<unknown> {
  initialization ??= init().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

function pack(boundary: Boundary): Float32Array {
  const packed = new Float32Array(boundary.m.length * 3);
  boundary.m.forEach((value, index) => {
    packed[index * 3] = value;
    packed[index * 3 + 1] = boundary.x[index] ?? -Infinity;
    packed[index * 3 + 2] = boundary.y[index] ?? -Infinity;
  });
  return packed;
}

function unpack(values: Float32Array, offset: number, length: number): Boundary {
  const boundary = { m: new Float32Array(length), x: new Float32Array(length), y: new Float32Array(length) };
  for (let i = 0; i < length; i += 1) {
    boundary.m[i] = values[offset + i * 3] ?? 0;
    boundary.x[i] = values[offset + i * 3 + 1] ?? -Infinity;
    boundary.y[i] = values[offset + i * 3 + 2] ?? -Infinity;
  }
  return boundary;
}

const matrices = {
  BLOSUM45: Float32Array.from(blosum.values.BLOSUM45.flat()),
  BLOSUM62: Float32Array.from(blosum.values.BLOSUM62.flat()),
  BLOSUM80: Float32Array.from(blosum.values.BLOSUM80.flat()),
};

/** Runs the initialized WASM kernel and copies only this tile's traceback cells. */
export function calculateWasmTile(request: TileRequest): TileResult {
  const { row, column, height, width, first, second } = request;
  const encode = (sequence: string) => Uint8Array.from(sequence, (residue) => blosum.alphabet.indexOf(residue));
  const output = calculate_tile(encode(first.slice(row, row + height)), encode(second.slice(column, column + width)),
    matrices[request.matrix], blosum.alphabet.length, pack(request.top), pack(request.left),
    request.mode === 'local', row + height === first.length, column + width === second.length);
  try {
    const boundaries = output.boundaries();
    const trace = output.trace();
    const target = new Uint8Array(request.trace);
    for (let i = 0; i < height; i += 1) {
      target.set(trace.subarray(i * width, (i + 1) * width), (row + i + 1) * (second.length + 1) + column + 1);
    }
    const best = output.best();
    const score = best[0] ?? 0;
    return { row, column, bottom: unpack(boundaries, 0, width + 1),
      right: unpack(boundaries, (width + 1) * 3, height + 1),
      best: { score, i: score > 0 ? row + (best[1] ?? 0) : 0,
        j: score > 0 ? column + (best[2] ?? 0) : 0, state: best[3] ?? 0 } };
  } finally {
    output.free();
  }
}
