import { z } from 'zod';
import { calculateDescriptors } from '../descriptors/descriptors';
import type { Descriptors } from '../descriptors/descriptors';
import { GENERATOR_CONFIG as C, GENERATOR_REFERENCES } from './config';

const interval = z.object({ enabled: z.boolean(), minimum: z.number(), maximum: z.number() }).strict().refine((value) => value.minimum <= value.maximum);
export const searchParametersSchema = z.object({
  length: z.number().int().min(C.minLength).max(C.maxLength),
  budget: z.number().int().min(C.minBudget).max(C.maxBudget),
  seed: z.number().int().min(1).max(C.maxSeed),
  gravy: interval.refine((value) => value.minimum >= -4.5 && value.maximum <= 4.5),
  massDa: interval.refine((value) => value.minimum > 0 && value.maximum <= 100_000),
}).strict().refine((value) => value.gravy.enabled || value.massDa.enabled);
export type SearchParameters = z.infer<typeof searchParametersSchema>;
export interface Candidate { sequence: string; descriptors: Descriptors; loss: number; satisfies: boolean }
export interface SearchArm { evaluations: number; matchingEvaluations: number; bestLoss: number; candidates: Candidate[]; minimumPairDistance: number | null }
export interface SearchResult { schemaVersion: 1; methodVersion: string; parameters: SearchParameters; guided: SearchArm; reference: SearchArm; references: readonly string[] }
export interface SearchProgress { completed: number; total: number }

/** Deterministic xorshift32 (13,17,5); this generator is not cryptographic. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}
function randomSequence(length: number, rng: () => number): string {
  let sequence = '';
  for (let index = 0; index < length; index += 1) sequence += C.alphabet.charAt(Math.floor(rng() * C.alphabet.length));
  return sequence;
}
function mutate(sequence: string, rng: () => number): string {
  const position = Math.floor(rng() * sequence.length);
  const previous = C.alphabet.indexOf(sequence.charAt(position));
  const offset = 1 + Math.floor(rng() * (C.alphabet.length - 1));
  return sequence.slice(0, position) + C.alphabet.charAt((previous + offset) % C.alphabet.length) + sequence.slice(position + 1);
}
function violation(value: number, target: SearchParameters['gravy'], minimumScale: number): number {
  if (!target.enabled) return 0;
  return Math.max(target.minimum - value, value - target.maximum, 0) / Math.max(target.maximum - target.minimum, minimumScale);
}
export function evaluateCandidate(sequence: string, parameters: SearchParameters): Candidate {
  const descriptors = calculateDescriptors(sequence);
  const loss = violation(descriptors.gravy, parameters.gravy, C.minimumGravyScale) + violation(descriptors.massDa, parameters.massDa, C.minimumMassScale);
  return { sequence, descriptors, loss, satisfies: loss === 0 && sequence.length === parameters.length };
}
/** Normalized positional Hamming distance for equal-length candidates. */
export function candidateDistance(first: string, second: string): number {
  if (first.length !== second.length || first.length === 0) throw new RangeError('Equal nonempty lengths required');
  let differences = 0;
  for (let index = 0; index < first.length; index += 1) if (first[index] !== second[index]) differences += 1;
  return differences / first.length;
}
function record(arm: SearchArm, candidate: Candidate): void {
  arm.evaluations += 1;
  if (candidate.satisfies) arm.matchingEvaluations += 1;
  arm.bestLoss = Math.min(arm.bestLoss, candidate.loss);
  // A bounded, deterministic quality-first archive. Diversity can reduce its size.
  const options = [...arm.candidates, candidate].sort((first, second) => first.loss - second.loss || (first.sequence < second.sequence ? -1 : first.sequence > second.sequence ? 1 : 0));
  arm.candidates = [];
  for (const option of options) {
    if (arm.candidates.every((other) => candidateDistance(option.sequence, other.sequence) >= C.minimumDistance)) arm.candidates.push(option);
    if (arm.candidates.length === C.retained) break;
  }
}
function finish(arm: SearchArm): void {
  let minimum: number | null = null;
  for (let first = 0; first < arm.candidates.length; first += 1) {
    for (let second = first + 1; second < arm.candidates.length; second += 1) {
      const firstCandidate = arm.candidates[first]; const secondCandidate = arm.candidates[second];
      if (!firstCandidate || !secondCandidate) continue;
      const distance = candidateDistance(firstCandidate.sequence, secondCandidate.sequence);
      minimum = minimum === null ? distance : Math.min(minimum, distance);
    }
  }
  arm.minimumPairDistance = minimum;
}

/** Two equally budgeted arms. Hooks run only between batches; Workers can be terminated at any time. */
export async function searchCandidates(raw: unknown, hooks: { progress?: (value: SearchProgress) => void; yield?: () => Promise<void>; cancelled?: () => boolean } = {}): Promise<SearchResult> {
  const parameters = searchParametersSchema.parse(raw);
  const guidedRng = random(parameters.seed);
  const referenceRng = random((parameters.seed ^ C.referenceSalt) >>> 0 || 1);
  const empty = (): SearchArm => ({ evaluations: 0, matchingEvaluations: 0, bestLoss: Infinity, candidates: [], minimumPairDistance: null });
  const guided = empty(); const reference = empty();
  let current = evaluateCandidate(randomSequence(parameters.length, guidedRng), parameters);
  for (let index = 0; index < parameters.budget; index += 1) {
    if (hooks.cancelled?.()) throw new DOMException('Cancelled', 'AbortError');
    if (index === 0) record(guided, current);
    else {
      const candidate = evaluateCandidate(mutate(current.sequence, guidedRng), parameters);
      record(guided, candidate);
      const temperature = C.initialTemperature * (C.finalTemperature / C.initialTemperature) ** (index / (parameters.budget - 1));
      if (candidate.loss <= current.loss || guidedRng() < Math.exp((current.loss - candidate.loss) / temperature)) current = candidate;
    }
    record(reference, evaluateCandidate(randomSequence(parameters.length, referenceRng), parameters));
    if ((index + 1) % C.batchSize === 0 || index + 1 === parameters.budget) {
      hooks.progress?.({ completed: (index + 1) * 2, total: parameters.budget * 2 });
      await hooks.yield?.();
    }
  }
  finish(guided); finish(reference);
  return { schemaVersion: 1, methodVersion: C.version, parameters, guided, reference, references: GENERATOR_REFERENCES };
}
