import { describe, expect, it } from 'vitest';
import { changesInside, columnKinds, firstSequencePositions } from './columns';
import { EXAMPLE_ALIGNMENT_INPUT } from './examples';
import { alignSequences } from './gotoh';
import { annotationsForAccession } from '../editor/annotations';

const SMALL = { alignedFirst: 'AC-DEK', alignedSecond: 'ACGDDR', marks: '|| |:.' };

describe('alignment columns', () => {
  it('classifies identical, similar, different and gap columns from the marks', () => {
    expect(columnKinds({ ...SMALL, marks: '|| |: ' })).toEqual(['identical', 'identical', 'gap', 'identical', 'similar', 'different']);
  });

  it('numbers the residues of the first sequence and skips its gaps', () => {
    expect(firstSequencePositions(SMALL)).toEqual([1, 2, null, 3, 4, 5]);
    expect(firstSequencePositions(SMALL, 10)).toEqual([10, 11, null, 12, 13, 14]);
  });

  it('counts changes inside and outside ranges of the first sequence', () => {
    const result = { ...SMALL, marks: '|| |: ' };
    expect(changesInside(result, [{ start: 4, end: 5 }])).toEqual({ inside: 2, outside: 1 });
    expect(changesInside(result, [])).toEqual({ inside: 0, outside: 3 });
  });

  it('finds three changes in the mature chains of human and bovine insulin', async () => {
    const result = await alignSequences(EXAMPLE_ALIGNMENT_INPUT.first, EXAMPLE_ALIGNMENT_INPUT.second, {});
    const mature = annotationsForAccession('P01308')?.regions.filter((region) => region.mature) ?? [];
    expect(result.columns).toBe(110);
    expect(result.identities).toBe(88);
    expect(columnKinds(result).filter((kind) => kind === 'gap')).toHaveLength(5);
    expect(changesInside(result, mature)).toEqual({ inside: 3, outside: 19 });
  });
});
