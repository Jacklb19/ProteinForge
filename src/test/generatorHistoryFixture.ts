import defaultExport from './generator-exports/default-export.json?raw';
import maximumExport from './generator-exports/maximum-export.json?raw';
import { addGeneratorRun, createGeneratorRun } from '../features/generator/history';
import type { GeneratorHistorySnapshot, GeneratorRunSelection } from '../features/generator/history';

/** Exact downloads of the real generator (backend tests/fixtures/generator/README.md has their provenance). */
export { defaultExport, maximumExport };
export const DEFAULT_EXPORT_SHA256 = 'c276bf594f50d9e89730ffc12ed3d96539bc08431828cf0081b07be5f1587de0';
export const MAXIMUM_EXPORT_SHA256 = '429e6cef00e312b470ec4f6f0d79f8703f3be0019eb14bd5d13e37bafd0ab5cd';
export const RECORDED_AT = '2026-10-27T14:30:00.000Z';

/** Shape-valid synthetic run: a real export with another seed, not a new search. */
export function exportWithSeed(seed: number, source = defaultExport): string {
  const result = JSON.parse(source) as { parameters: { seed: number } };
  result.parameters.seed = seed;
  return JSON.stringify(result, null, 2);
}

export async function historyFixture(texts: string[] = [defaultExport], selection: GeneratorRunSelection | null = { arm: 'guided', index: 0 }): Promise<GeneratorHistorySnapshot> {
  let history: GeneratorHistorySnapshot | null = null;
  for (const text of texts) history = (await addGeneratorRun(history, await createGeneratorRun(text, { recordedAt: RECORDED_AT, appBuild: null, selection }))).history;
  if (!history) throw new Error('At least one export is required');
  return history;
}
