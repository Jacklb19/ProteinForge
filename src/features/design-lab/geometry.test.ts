import { required } from './config';
import { describe, expect, it } from 'vitest';
import { parseFasta, parsePdb, superpose } from './geometry';
import { loadExample } from './validate';
import { tracePdb } from './presentation';
import type { Coordinates } from './types';
describe('proper structural comparison', () => {
    const reference: Coordinates[] = [[0, 0, 0], [1, 0, 0], [0, 2, 0], [0, 0, 3]];
    it('removes a known rotation and translation without changing the source', () => {
        const moved = reference.map(([x, y, z]) => [-y + 5, x - 7, z + 2] as Coordinates), before = JSON.stringify(moved);
        const fit = superpose(reference, moved);
        expect(fit.rmsd).toBeLessThan(1e-10);
        expect(JSON.stringify(moved)).toBe(before);
    });
    it('does not fit a reflection as if it were a rigid rotation', () => { expect(superpose(reference, reference.map(([x, y, z]) => [-x, y, z])).rmsd).toBeGreaterThan(.5); });
    it('rejects incompatible or nonfinite arrays', () => { expect(() => superpose(reference, reference.slice(1))).toThrow(); expect(() => superpose(reference, [[NaN, 0, 0], ...reference.slice(1)])).toThrow(); });
    it('recalculates the three actual curated Colab comparisons', async () => {
        const { dataset } = await loadExample();
        const expected = [.821844462267482, .7509967359914047, 1.21120669340175];
        dataset.variants.forEach((variant, index) => { expect(variant.rmsd).toBeCloseTo(required(expected[index]), 9); expect(variant.pdb).toBeNull(); expect(variant.keys).toHaveLength(76); });
    });
    it('exports the example as an explicitly incomplete Cα trace', async () => {
        const { dataset } = await loadExample(), variant = required(dataset.variants[0]), text = tracePdb(variant);
        const atoms = text.split('\n').filter(line => line.startsWith('ATOM  '));
        expect(atoms).toHaveLength(76);
        expect(atoms.every(line => line.slice(12, 16).trim() === 'CA')).toBe(true);
        expect(text).toContain('C-ALPHA TRACE ONLY');
        expect(() => parsePdb(text, 'A', variant.sequence)).toThrow();
    });
    it.each(['AAA\n>bad\nAAA', '>empty\n', '>multi\nAA/AA', '>unknown\nAAX'])('rejects invalid FASTA %s', value => { expect(() => parseFasta(value)).toThrow(); });
    it('bounds FASTA candidate count and combined multiline length', () => {
        expect(() => parseFasta('>long\n' + 'A'.repeat(100) + '\n' + 'A'.repeat(21))).toThrow();
        expect(() => parseFasta('>one\nA\n'.repeat(5))).toThrow();
    });
});
