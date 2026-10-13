import { ALIGNMENT_MARKS, GAP_CHARACTER } from './config';
import type { AlignmentResult } from './gotoh';

export type ColumnKind = 'identical' | 'similar' | 'different' | 'gap';

type Aligned = Pick<AlignmentResult, 'alignedFirst' | 'alignedSecond' | 'marks'>;

/** What happens in one alignment column, from the marks the algorithm already produced. */
export function columnKind(result: Aligned, index: number): ColumnKind {
  if (result.alignedFirst[index] === GAP_CHARACTER || result.alignedSecond[index] === GAP_CHARACTER) return 'gap';
  const mark = result.marks[index];
  if (mark === ALIGNMENT_MARKS.identical) return 'identical';
  return mark === ALIGNMENT_MARKS.similar ? 'similar' : 'different';
}

export function columnKinds(result: Aligned): ColumnKind[] {
  return Array.from(result.alignedFirst, (_, index) => columnKind(result, index));
}

/**
 * One-based position in the first sequence for every column, or `null` where the first sequence has a gap.
 * `offset` is the position of the first aligned residue; local alignments may start after the first residue.
 */
export function firstSequencePositions(result: Aligned, offset = 1): (number | null)[] {
  let position = offset - 1;
  return Array.from(result.alignedFirst, (residue) => {
    if (residue === GAP_CHARACTER) return null;
    position += 1;
    return position;
  });
}

/** Columns that are not identical, split by whether they fall inside the given position ranges. */
export function changesInside(result: Aligned, ranges: readonly { start: number; end: number }[]): { inside: number; outside: number } {
  const positions = firstSequencePositions(result);
  let inside = 0;
  let outside = 0;
  columnKinds(result).forEach((kind, index) => {
    if (kind === 'identical') return;
    const position = positions[index];
    if (position !== null && position !== undefined && ranges.some((range) => position >= range.start && position <= range.end)) inside += 1;
    else outside += 1;
  });
  return { inside, outside };
}
