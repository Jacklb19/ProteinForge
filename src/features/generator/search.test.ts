import { describe, expect, it } from 'vitest';
import { calculateDescriptors } from '../descriptors/descriptors';
import { candidateDistance, evaluateCandidate, searchCandidates, searchParametersSchema } from './search';
import type { SearchParameters } from './search';
import { INITIAL_SEARCH_FORM, parseSearchForm } from './context';
import { GENERATOR_CONFIG } from './config';
const parameters: SearchParameters = { length: 30, budget: 500, seed: 42, gravy: { enabled: true, minimum: 1.9, maximum: 2.1 }, massDa: { enabled: false, minimum: 3000, maximum: 6000 } };

describe('candidate search', () => {
  it('reproduces both arms, counts the same budget, measures retained diversity and recalculates every candidate', async () => {
    const first = await searchCandidates(parameters); const second = await searchCandidates(parameters);
    expect(second).toEqual(first);
    for (const arm of [first.guided, first.reference]) {
      expect(arm.evaluations).toBe(parameters.budget);
      expect(arm.matchingEvaluations).toBeGreaterThanOrEqual(0); expect(arm.matchingEvaluations).toBeLessThanOrEqual(parameters.budget);
      expect(arm.candidates.length).toBeLessThanOrEqual(GENERATOR_CONFIG.retained);
      expect(new Set(arm.candidates.map((candidate) => candidate.sequence)).size).toBe(arm.candidates.length);
      for (const candidate of arm.candidates) {
        expect(candidate.sequence).toMatch(/^[ACDEFGHIKLMNPQRSTVWY]{30}$/);
        expect(candidate.descriptors).toEqual(calculateDescriptors(candidate.sequence));
        expect(candidate.satisfies).toBe(candidate.descriptors.gravy >= 1.9 && candidate.descriptors.gravy <= 2.1);
        expect(candidate.loss).toBeGreaterThanOrEqual(0);
      }
      const distances = arm.candidates.flatMap((firstCandidate, index) => arm.candidates.slice(index + 1).map((other) => candidateDistance(firstCandidate.sequence, other.sequence)));
      expect(arm.minimumPairDistance).toBe(distances.length ? Math.min(...distances) : null);
      expect(distances.every((distance) => distance >= 0.1)).toBe(true);
    }
  });
  it('implements inclusive physical ranges, disabled terms and normalized violation without success claims', async () => {
    const sequence = 'AAAAA'; const descriptors = calculateDescriptors(sequence);
    const target = { ...parameters, length: 5, budget: 100, gravy: { enabled: true, minimum: descriptors.gravy, maximum: descriptors.gravy }, massDa: { enabled: true, minimum: descriptors.massDa, maximum: descriptors.massDa } };
    expect(evaluateCandidate(sequence, target).loss).toBe(0);
    expect(evaluateCandidate(sequence, { ...target, massDa: { enabled: true, minimum: descriptors.massDa + 2, maximum: descriptors.massDa + 2 } }).loss).toBe(2);
    const impossible = await searchCandidates({ ...target, massDa: { enabled: true, minimum: 99_000, maximum: 100_000 } });
    expect(impossible.guided.matchingEvaluations).toBe(0); expect(impossible.reference.matchingEvaluations).toBe(0);
    expect(impossible.guided.candidates.every((candidate) => !candidate.satisfies)).toBe(true);
    expect(() => candidateDistance('A', 'AA')).toThrow(RangeError);
  });
  it('rejects invalid boundaries and reports progress/cancellation between bounded batches', async () => {
    for (const changes of [{ seed: 0 }, { seed: 4294967296 }, { length: 301 }, { budget: 99 }, { budget: 1.5 }, { gravy: { enabled: true, minimum: 1, maximum: -1 } }, { gravy: { enabled: false, minimum: -1, maximum: 1 }, massDa: { enabled: false, minimum: 1, maximum: 2 } }]) expect(searchParametersSchema.safeParse({ ...parameters, ...changes }).success).toBe(false);
    expect(parseSearchForm({ ...INITIAL_SEARCH_FORM, gravyMinimum: '' }).success).toBe(false);
    const progress: number[] = []; let cancelled = false;
    await expect(searchCandidates(parameters, { progress: (value) => { progress.push(value.completed); }, yield: () => { cancelled = true; return Promise.resolve(); }, cancelled: () => cancelled })).rejects.toMatchObject({ name: 'AbortError' });
    expect(progress).toEqual([100]);
  });
});
