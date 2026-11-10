import blosum from './fixtures/blosum.json' with { type: 'json' };
import { DEFAULT_MATRIX, GAP_CHARACTER, MULTIPLE_MAX_RESIDUES, MULTIPLE_MAX_SEQUENCES, MULTIPLE_MIN_SEQUENCES } from './config';
import type { MatrixName } from './config';
import { alignSequences, normalizeForAlignment } from './gotoh';
import type { ColumnKind } from './columns';
import { LocalizedRangeError } from '../../i18n/localized';

export interface MultipleEntry { name: string; sequence: string }
export interface MultipleAlignment {
  /** Rows in the order they were given; every `aligned` has the same length. */
  rows: { name: string; aligned: string }[];
  /** Index of the sequence the others were aligned to. */
  center: number;
  columns: number;
  kinds: ColumnKind[];
  /** Columns where every sequence has the same residue. */
  identical: number;
  matrix: MatrixName;
}
export interface MultipleOptions { matrix?: MatrixName; onProgress?: (fraction: number) => void; isCancelled?: () => boolean }

const ALPHABET = blosum.alphabet;

/**
 * Adds one sequence to rows already aligned to the centre. `master` is the centre as it stands in those rows;
 * `pairCentre` and `pairOther` are the centre and the new sequence aligned to each other. A gap the new
 * sequence opens in the centre becomes a gap in every row: once a gap, always a gap.
 */
export function mergeIntoStar(rows: string[], master: string, pairCentre: string, pairOther: string): { rows: string[]; added: string } {
  const merged: string[][] = rows.map(() => []);
  const added: string[] = [];
  let i = 0, j = 0;
  const keep = (): void => { rows.forEach((row, index) => merged[index]?.push(row[i] ?? GAP_CHARACTER)); };
  const open = (): void => { merged.forEach(row => row.push(GAP_CHARACTER)); };
  while (i < master.length || j < pairCentre.length) {
    const here = master[i], there = pairCentre[j];
    if (here === GAP_CHARACTER && there !== GAP_CHARACTER) { keep(); added.push(GAP_CHARACTER); i += 1; }
    else if (there === GAP_CHARACTER && here !== GAP_CHARACTER) { open(); added.push(pairOther[j] ?? GAP_CHARACTER); j += 1; }
    else if (here === undefined) { open(); added.push(pairOther[j] ?? GAP_CHARACTER); j += 1; }
    else if (there === undefined) { keep(); added.push(GAP_CHARACTER); i += 1; }
    else { keep(); added.push(pairOther[j] ?? GAP_CHARACTER); i += 1; j += 1; }
  }
  return { rows: merged.map(row => row.join('')), added: added.join('') };
}

/** One column across every row: a gap anywhere, the same residue everywhere, or all scoring positively against the centre. */
export function columnKindAcross(residues: readonly string[], centre: number, matrix: MatrixName): ColumnKind {
  if (residues.includes(GAP_CHARACTER)) return 'gap';
  const first = residues[0];
  if (residues.every(residue => residue === first)) return 'identical';
  const row = blosum.values[matrix][ALPHABET.indexOf(residues[centre] ?? '')] ?? [];
  return residues.every(residue => (row[ALPHABET.indexOf(residue)] ?? -1) > 0) ? 'similar' : 'different';
}

/**
 * Star alignment: every pair is aligned globally with the same Gotoh as Compare, the sequence with the highest
 * total score becomes the centre and the others are merged onto it. A heuristic, not an optimal multiple
 * alignment: it is exact for each sequence against the centre, not between the others.
 */
export async function alignMultiple(entries: readonly MultipleEntry[], options: MultipleOptions = {}): Promise<MultipleAlignment> {
  const matrix = options.matrix ?? DEFAULT_MATRIX;
  if (entries.length < MULTIPLE_MIN_SEQUENCES || entries.length > MULTIPLE_MAX_SEQUENCES) throw new LocalizedRangeError('errors.multipleCount');
  const sequences = entries.map(entry => normalizeForAlignment(entry.sequence).sequence);
  if (sequences.some(sequence => sequence.length > MULTIPLE_MAX_RESIDUES)) throw new LocalizedRangeError('errors.multipleLength');
  const count = sequences.length;
  const pairs = count * (count - 1) / 2;
  const totals = new Array<number>(count).fill(0);
  const aligned = new Map<string, { first: string; second: string }>();
  let done = 0;
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) {
      if (options.isCancelled?.()) throw new LocalizedRangeError('alignment.cancelled');
      const result = await alignSequences(sequences[a] ?? '', sequences[b] ?? '', { matrix, mode: 'global', isCancelled: options.isCancelled });
      totals[a] = (totals[a] ?? 0) + result.score;
      totals[b] = (totals[b] ?? 0) + result.score;
      aligned.set(`${String(a)}:${String(b)}`, { first: result.alignedFirst, second: result.alignedSecond });
      done += 1;
      options.onProgress?.(done / pairs);
    }
  }
  // The first of equal totals wins, so the same input always gives the same centre.
  const centre = totals.reduce((best, total, index) => total > (totals[best] ?? Number.NEGATIVE_INFINITY) ? index : best, 0);
  let master = sequences[centre] ?? '';
  let rows: string[] = [];
  const order: number[] = [];
  for (let other = 0; other < count; other += 1) {
    if (other === centre) continue;
    const pair = aligned.get(other < centre ? `${String(other)}:${String(centre)}` : `${String(centre)}:${String(other)}`);
    if (!pair) throw new LocalizedRangeError('errors.invalidAlignmentParameters');
    const [pairCentre, pairOther] = other < centre ? [pair.second, pair.first] : [pair.first, pair.second];
    const merged = mergeIntoStar([master, ...rows], master, pairCentre, pairOther);
    [master = '', ...rows] = merged.rows;
    rows.push(merged.added);
    order.push(other);
  }
  const byIndex = new Map<number, string>([[centre, master], ...order.map((index, position): [number, string] => [index, rows[position] ?? ''])]);
  const result = entries.map((entry, index) => ({ name: entry.name, aligned: byIndex.get(index) ?? '' }));
  const kinds = Array.from(master, (_, column) => columnKindAcross(result.map(row => row.aligned[column] ?? GAP_CHARACTER), centre, matrix));
  return { rows: result, center: centre, columns: master.length, kinds, identical: kinds.filter(kind => kind === 'identical').length, matrix };
}
