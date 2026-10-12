import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { searchCandidates } from './search';
it('records equal-budget measurements across fixed seeds without asserting superiority', async () => {
  const parameters = { length: 30, budget: 500, gravy: { enabled: true, minimum: 1.9, maximum: 2.1 }, massDa: { enabled: false, minimum: 3000, maximum: 6000 } };
  const rows = [];
  for (const seed of [1, 7, 42, 100, 2026]) {
    const result = await searchCandidates({ ...parameters, seed });
    expect(result.guided.evaluations).toBe(500); expect(result.reference.evaluations).toBe(500);
    rows.push({ seed, guided: { matches: result.guided.matchingEvaluations, loss: result.guided.bestLoss, diversity: result.guided.minimumPairDistance }, reference: { matches: result.reference.matchingEvaluations, loss: result.reference.bestLoss, diversity: result.reference.minimumPairDistance } });
  }
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/candidate-benchmark.json', JSON.stringify({ parameters, rows }, null, 2));
});
