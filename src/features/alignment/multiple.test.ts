import { describe, expect, it } from 'vitest';
import { GAP_CHARACTER, MULTIPLE_MAX_RESIDUES, MULTIPLE_MAX_SEQUENCES } from './config';
import { alignMultiple, columnKindAcross, mergeIntoStar } from './multiple';

const entry = (name: string, sequence: string) => ({ name, sequence });
const ungapped = (aligned: string): string => aligned.replaceAll(GAP_CHARACTER, '');

describe('mergeIntoStar', () => {
  it('adds a sequence without touching the columns already there', () => {
    expect(mergeIntoStar(['ACDE'], 'ACDE', 'ACDE', 'ACKE')).toEqual({ rows: ['ACDE'], added: 'ACKE' });
  });
  it('opens in every row the gap a new sequence needs in the centre', () => {
    const merged = mergeIntoStar(['ACDE', 'ACDE'], 'ACDE', 'AC-DE', 'ACWDE');
    expect(merged).toEqual({ rows: ['AC-DE', 'AC-DE'], added: 'ACWDE' });
  });
  it('keeps a gap the centre already has and gives it to the new sequence', () => {
    const merged = mergeIntoStar(['AC-DE', 'ACWDE'], 'AC-DE', 'ACDE', 'AC-E');
    expect(merged).toEqual({ rows: ['AC-DE', 'ACWDE'], added: 'AC--E' });
  });
  it('handles insertions at either end', () => {
    expect(mergeIntoStar(['ACD'], 'ACD', '-ACD-', 'WACDW')).toEqual({ rows: ['-ACD-'], added: 'WACDW' });
  });
});

describe('columnKindAcross', () => {
  it('tells gaps, identity, conservative and other changes apart', () => {
    expect(columnKindAcross(['A', '-', 'A'], 0, 'BLOSUM62')).toBe('gap');
    expect(columnKindAcross(['L', 'L', 'L'], 0, 'BLOSUM62')).toBe('identical');
    // Leu, Ile and Met score positively against each other in BLOSUM62.
    expect(columnKindAcross(['L', 'I', 'M'], 0, 'BLOSUM62')).toBe('similar');
    expect(columnKindAcross(['L', 'I', 'D'], 0, 'BLOSUM62')).toBe('different');
  });
});

describe('alignMultiple', () => {
  it('returns every sequence intact, in the given order, in rows of one length', async () => {
    const entries = [entry('a', 'MKTAYIAKQRQISFVKSHFSRQ'), entry('b', 'MKTAYIAKQRISFVKSHFSRQ'), entry('c', 'MKTAYIAKQRQISWFVKSHFSRQ'), entry('d', 'KTAYIAKQRQISFVKSHF')];
    const result = await alignMultiple(entries);
    expect(result.rows.map(row => row.name)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.rows.map(row => ungapped(row.aligned))).toEqual(entries.map(item => item.sequence));
    expect(new Set(result.rows.map(row => row.aligned.length))).toEqual(new Set([result.columns]));
    expect(result.kinds).toHaveLength(result.columns);
    expect(result.identical).toBe(result.kinds.filter(kind => kind === 'identical').length);
    // No column is made only of gaps.
    for (let column = 0; column < result.columns; column += 1) expect(result.rows.some(row => row.aligned[column] !== GAP_CHARACTER)).toBe(true);
  });

  it('aligns identical sequences without a gap', async () => {
    const result = await alignMultiple([entry('a', 'ACDEFGHIK'), entry('b', 'ACDEFGHIK'), entry('c', 'ACDEFGHIK')]);
    expect(result.rows.map(row => row.aligned)).toEqual(['ACDEFGHIK', 'ACDEFGHIK', 'ACDEFGHIK']);
    expect(result.identical).toBe(9);
    expect(result.center).toBe(0);
  });

  it('puts a single substitution and a single deletion in their own columns', async () => {
    const result = await alignMultiple([entry('ref', 'MKTAYIAKQRQISFVK'), entry('sub', 'MKTAYIAKQRQISWVK'), entry('del', 'MKTAYIAQRQISFVK')]);
    expect(result.columns).toBe(16);
    expect(result.kinds.filter(kind => kind === 'gap')).toHaveLength(1);
    expect(result.kinds.filter(kind => kind === 'identical')).toHaveLength(14);
  });

  it('gives the same answer for the same input and reports progress up to one', async () => {
    const entries = [entry('a', 'MKTAYIAKQR'), entry('b', 'MKTAYIAKQK'), entry('c', 'MKTWYIAKQR')];
    const progress: number[] = [];
    const first = await alignMultiple(entries, { onProgress: value => progress.push(value) });
    expect(await alignMultiple(entries)).toEqual(first);
    expect(progress).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('refuses too few, too many, too long or invalid sequences, and stops when cancelled', async () => {
    await expect(alignMultiple([entry('a', 'ACD'), entry('b', 'ACD')])).rejects.toThrow();
    await expect(alignMultiple(Array.from({ length: MULTIPLE_MAX_SEQUENCES + 1 }, (_, index) => entry(String(index), 'ACD')))).rejects.toThrow();
    await expect(alignMultiple([entry('a', 'A'.repeat(MULTIPLE_MAX_RESIDUES + 1)), entry('b', 'ACD'), entry('c', 'ACD')])).rejects.toThrow();
    await expect(alignMultiple([entry('a', 'AC1'), entry('b', 'ACD'), entry('c', 'ACD')])).rejects.toThrow();
    await expect(alignMultiple([entry('a', 'ACD'), entry('b', 'ACD'), entry('c', 'ACD')], { isCancelled: () => true })).rejects.toThrow();
  });
});
