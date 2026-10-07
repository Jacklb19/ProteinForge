import type { AlignmentInput } from './alignmentDraft';
import type { AlignmentResult } from './gotoh';
import { GAP_CHARACTER } from './config';

/** Columns where either aligned sequence has a gap, as reported by EMBOSS Needle and Water. */
export function countGapColumns(result: Pick<AlignmentResult, 'alignedFirst' | 'alignedSecond'>): number {
  let gaps = 0;
  for (let index = 0; index < result.alignedFirst.length; index += 1) {
    if (result.alignedFirst[index] === GAP_CHARACTER || result.alignedSecond[index] === GAP_CHARACTER) gaps += 1;
  }
  return gaps;
}

/** Whether the inputs currently on screen differ from those that produced the result. */
export function isStaleResult(produced: AlignmentInput | null, current: AlignmentInput): boolean {
  if (!produced) return false;
  return produced.first !== current.first || produced.second !== current.second
    || produced.matrix !== current.matrix || produced.mode !== current.mode;
}
