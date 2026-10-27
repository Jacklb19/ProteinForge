import { ApiError } from '../api/errors';
import { GENERATOR_HISTORY_CONFIG as C } from './config';
import { readGeneratorResult } from './history';
import { searchCandidates } from './search';
import type { SearchProgress, SearchResult } from './search';

/** identical: same bytes as the saved export; equivalent: same values, other formatting; different: see paths. */
export type ReproductionStatus = 'identical' | 'equivalent' | 'different';
export interface ReproductionResult { status: ReproductionStatus; differences: string[] }
export interface ReproductionHooks { progress?: (value: SearchProgress) => void; yield?: () => Promise<void>; cancelled?: () => boolean }

/** Paths whose values differ, in reading order; the saved run is only read. */
export function compareResults(saved: SearchResult, rerun: SearchResult): string[] {
  const differences: string[] = [];
  const check = (path: string, first: unknown, second: unknown): void => { if (!Object.is(first, second)) differences.push(path); };
  check('methodVersion', saved.methodVersion, rerun.methodVersion);
  for (const arm of C.arms) {
    const [before, after] = [saved[arm], rerun[arm]];
    for (const field of ['evaluations', 'matchingEvaluations', 'bestLoss', 'minimumPairDistance'] as const) check(`${arm}.${field}`, before[field], after[field]);
    check(`${arm}.candidates.length`, before.candidates.length, after.candidates.length);
    before.candidates.forEach((candidate, index) => {
      const other = after.candidates[index];
      const path = `${arm}.candidates[${String(index)}]`;
      if (!other) return;
      check(`${path}.sequence`, candidate.sequence, other.sequence);
      check(`${path}.loss`, candidate.loss, other.loss);
      check(`${path}.satisfies`, candidate.satisfies, other.satisfies);
      for (const field of Object.keys(candidate.descriptors) as (keyof typeof candidate.descriptors)[]) check(`${path}.descriptors.${field}`, candidate.descriptors[field], other.descriptors[field]);
    });
  }
  return differences;
}

/**
 * Repeats a saved search with its own parameters and compares it with the saved text. Costly
 * (up to twice the budget of evaluations), so it runs only when someone asks, inside a Worker.
 */
export async function reproduceRun(resultJson: string, hooks: ReproductionHooks = {}): Promise<ReproductionResult> {
  const saved = readGeneratorResult(resultJson);
  // The contract admits only method versions this generator implements, so the search is the same method.
  if (!saved) throw new ApiError('validation');
  const rerun = await searchCandidates(saved.parameters, hooks);
  if (JSON.stringify(rerun, null, 2) === resultJson) return { status: 'identical', differences: [] };
  const differences = compareResults(saved, rerun);
  return { status: differences.length ? 'different' : 'equivalent', differences };
}
