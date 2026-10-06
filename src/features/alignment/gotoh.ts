import blosum from './fixtures/blosum.json';
import { translate } from '../../i18n/translate';

/** Available substitution matrices for protein alignment. */
export type MatrixName = 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80';
export type AlignmentMode = 'global' | 'local';

/** Complete parameters stored with each reproducible result. */
export interface AlignmentParameters {
  matrix: MatrixName;
  mode: AlignmentMode;
  gapOpen: 10;
  gapExtend: 0.5;
  terminalGaps: 'free' | 'not-applicable';
}

/** Aligned sequences and numeric metrics. */
export interface AlignmentResult {
  alignedFirst: string;
  alignedSecond: string;
  marks: string;
  score: number;
  identities: number;
  similarities: number;
  columns: number;
  parameters: AlignmentParameters;
}

export interface AlignmentOptions {
  matrix?: MatrixName;
  mode?: AlignmentMode;
  onProgress?: (fraction: number) => void;
  isCancelled?: () => boolean;
}

const ALPHABET = blosum.alphabet;
const GAP_OPEN = 10;
const GAP_EXTEND = 0.5;
const M = 0;
const X = 1;
const Y = 2;
const STOP = 3;

/** Maps selenocysteine and pyrrolysine only for alignment scoring. */
export function normalizeForAlignment(sequence: string): { sequence: string; warnings: string[] } {
  const warnings: string[] = [];
  if (sequence.includes('U')) warnings.push(translate('es', 'alignment.warningU'));
  if (sequence.includes('O')) warnings.push(translate('es', 'alignment.warningO'));
  const normalized = sequence.replaceAll('U', 'C').replaceAll('O', 'K');
  if (Array.from(normalized).some((residue) => !ALPHABET.includes(residue))) {
    throw new RangeError(translate('es', 'errors.invalidAlignmentResidues'));
  }
  if (normalized.length === 0) throw new RangeError(translate('es', 'errors.emptyAlignment'));
  return { sequence: normalized, warnings };
}

/** Traceback bytes plus six Float32 score rows for two sequence lengths. */
export function tracebackMemoryBytes(firstLength: number, secondLength: number): number {
  const width = secondLength + 1;
  return (firstLength + 1) * width + 6 * width * Float32Array.BYTES_PER_ELEMENT;
}

function marksFor(first: string, second: string, matrix: number[][]): string {
  let marks = '';
  for (let index = 0; index < first.length; index += 1) {
    const a = first[index] ?? '-';
    const b = second[index] ?? '-';
    if (a === '-' || b === '-') marks += ' ';
    else if (a === b) marks += '|';
    else marks += (matrix[ALPHABET.indexOf(a)]?.[ALPHABET.indexOf(b)] ?? 0) > 0 ? ':' : ' ';
  }
  return marks;
}

/** Reconstructs columns and metrics from compact traceback storage. */
export function buildResult(
  a: string,
  b: string,
  matrix: MatrixName,
  mode: AlignmentMode,
  trace: Uint8Array,
  best: { score: number; i: number; j: number; state: number },
): AlignmentResult {
  const width = b.length + 1;
  const alignedA: string[] = [];
  const alignedB: string[] = [];
  if (mode === 'global') {
    for (let i = a.length; i > best.i; i -= 1) { alignedA.push(a[i - 1] ?? ''); alignedB.push('-'); }
    for (let j = b.length; j > best.j; j -= 1) { alignedA.push('-'); alignedB.push(b[j - 1] ?? ''); }
  }
  let i = best.i;
  let j = best.j;
  let state = best.state;
  while (i > 0 && j > 0) {
    const code = trace[i * width + j] ?? 0;
    if (state === M) {
      if (mode === 'local' && (code & 3) === STOP) break;
      alignedA.push(a[i - 1] ?? '');
      alignedB.push(b[j - 1] ?? '');
      i -= 1;
      j -= 1;
      state = code & 3;
    } else if (state === X) {
      alignedA.push(a[i - 1] ?? '');
      alignedB.push('-');
      i -= 1;
      state = code & 4 ? X : M;
    } else {
      alignedA.push('-');
      alignedB.push(b[j - 1] ?? '');
      j -= 1;
      state = code & 8 ? Y : M;
    }
  }
  if (mode === 'global') {
    while (i > 0) { alignedA.push(a[--i] ?? ''); alignedB.push('-'); }
    while (j > 0) { alignedA.push('-'); alignedB.push(b[--j] ?? ''); }
  }
  const alignedFirst = alignedA.reverse().join('');
  const alignedSecond = alignedB.reverse().join('');
  const marks = marksFor(alignedFirst, alignedSecond, blosum.values[matrix]);
  return {
    alignedFirst,
    alignedSecond,
    marks,
    score: best.score,
    identities: Array.from(marks).filter((mark) => mark === '|').length,
    similarities: Array.from(marks).filter((mark) => mark === '|' || mark === ':').length,
    columns: marks.length,
    parameters: { matrix, mode, gapOpen: 10, gapExtend: 0.5, terminalGaps: mode === 'global' ? 'free' : 'not-applicable' },
  };
}

/** Runs Gotoh with reused score rows and one traceback byte per cell. */
export async function alignSequences(
  first: string,
  second: string,
  options: AlignmentOptions = {},
): Promise<AlignmentResult> {
  const matrix = options.matrix ?? 'BLOSUM62';
  const mode = options.mode ?? 'global';
  if (!['BLOSUM45', 'BLOSUM62', 'BLOSUM80'].includes(matrix) || !['global', 'local'].includes(mode)) {
    throw new RangeError(translate('es', 'errors.invalidAlignmentParameters'));
  }
  const a = normalizeForAlignment(first).sequence;
  const b = normalizeForAlignment(second).sequence;
  const width = b.length + 1;
  const trace = new Uint8Array((a.length + 1) * width);
  let previousM = new Float32Array(width);
  let previousX = new Float32Array(width).fill(Number.NEGATIVE_INFINITY);
  let previousY = new Float32Array(width).fill(Number.NEGATIVE_INFINITY);
  let currentM = new Float32Array(width);
  let currentX = new Float32Array(width);
  let currentY = new Float32Array(width);
  const values = blosum.values[matrix];
  let best = 0;
  let bestI = 0;
  let bestJ = mode === 'global' ? b.length : 0;
  let bestState = M;

  for (let i = 1; i <= a.length; i += 1) {
    currentM[0] = 0;
    currentX[0] = Number.NEGATIVE_INFINITY;
    currentY[0] = Number.NEGATIVE_INFINITY;
    const row = values[ALPHABET.indexOf(a[i - 1] ?? '')] ?? [];
    for (let j = 1; j <= b.length; j += 1) {
      const index = i * width + j;
      let diagonal = previousM[j - 1] ?? 0;
      let originM = M;
      if ((previousX[j - 1] ?? -Infinity) > diagonal) {
        diagonal = previousX[j - 1] ?? -Infinity;
        originM = X;
      }
      if ((previousY[j - 1] ?? -Infinity) > diagonal) {
        diagonal = previousY[j - 1] ?? -Infinity;
        originM = Y;
      }
      let matchScore = diagonal + (row[ALPHABET.indexOf(b[j - 1] ?? '')] ?? -Infinity);
      if (mode === 'local' && matchScore <= 0) {
        matchScore = 0;
        originM = STOP;
      }
      const openX = (previousM[j] ?? -Infinity) - GAP_OPEN;
      const extendX = (previousX[j] ?? -Infinity) - GAP_EXTEND;
      const openY = (currentM[j - 1] ?? -Infinity) - GAP_OPEN;
      const extendY = (currentY[j - 1] ?? -Infinity) - GAP_EXTEND;
      currentM[j] = matchScore;
      currentX[j] = Math.max(openX, extendX);
      currentY[j] = Math.max(openY, extendY);
      trace[index] = originM | (extendX > openX ? 4 : 0) | (extendY > openY ? 8 : 0);
      if (mode === 'local' || i === a.length || j === b.length) {
        const candidates: [number, number][] = [[M, matchScore], [X, currentX[j] ?? -Infinity], [Y, currentY[j] ?? -Infinity]];
        for (const [state, score] of candidates) {
          if (score > best) {
            best = score;
            bestI = i;
            bestJ = j;
            bestState = state;
          }
        }
      }
    }
    [previousM, currentM] = [currentM, previousM];
    [previousX, currentX] = [currentX, previousX];
    [previousY, currentY] = [currentY, previousY];
    if (i % 64 === 0 || i === a.length) {
      options.onProgress?.(i / a.length);
      await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
      if (options.isCancelled?.()) throw new Error(translate('es', 'alignment.cancelled'));
    }
  }

  return buildResult(a, b, matrix, mode, trace, {
    score: best,
    i: bestI,
    j: bestJ,
    state: bestState,
  });
}
