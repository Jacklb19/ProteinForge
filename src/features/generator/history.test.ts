import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import { sha256 } from '../design-lab/zip';
import { GENERATOR_HISTORY_CONFIG as C } from './config';
import {
  addGeneratorRun, createGeneratorRun, generatorHistoryRuns, generatorHistorySnapshotSchema, generatorRunSchema,
  hasDuplicateKeys, parseStrictJson, readGeneratorResult, removeGeneratorRun, verifyGeneratorHistory,
} from './history';
import type { GeneratorRun } from './history';
import type { Candidate, SearchArm, SearchResult } from './search';
import { DEFAULT_EXPORT_SHA256, MAXIMUM_EXPORT_SHA256, RECORDED_AT, defaultExport, exportWithSeed, historyFixture, maximumExport } from '../../test/generatorHistoryFixture';

const encoder = new TextEncoder();
const details = { recordedAt: RECORDED_AT, appBuild: null, selection: null };
async function envelope(documentJson: string) { return { schemaVersion: 1 as const, documentJson, documentSha256: await sha256(encoder.encode(documentJson)) }; }
function edited(change: (result: SearchResult) => void): string {
  const result = JSON.parse(defaultExport) as SearchResult;
  change(result);
  return JSON.stringify(result, null, 2);
}
function first(arm: SearchArm): Candidate {
  const candidate = arm.candidates[0];
  if (!candidate) throw new Error('Fixture without candidates');
  return candidate;
}

describe('generator history contract', () => {
  it('keeps real exports byte for byte, identified by the SHA-256 of their exact text', async () => {
    const run = await createGeneratorRun(maximumExport, { ...details, appBuild: '0123abc', selection: { arm: 'reference', index: 4 } });
    expect(run.id).toBe(MAXIMUM_EXPORT_SHA256);
    // Callers may pass richer records; only the run fields are stored.
    expect(await createGeneratorRun(defaultExport, Object.assign({ text: defaultExport }, details))).not.toHaveProperty('text');
    const history = await historyFixture([defaultExport, maximumExport]);
    const runs = generatorHistoryRuns(history);
    expect(runs.map((item) => item.id)).toEqual([DEFAULT_EXPORT_SHA256, MAXIMUM_EXPORT_SHA256]);
    expect(runs[1]?.resultJson).toBe(maximumExport);
    expect(await verifyGeneratorHistory(history)).toBe(true);
    expect(await verifyGeneratorHistory({ ...history, documentSha256: '0'.repeat(64) })).toBe(false);
  });

  it('rejects repeated keys like the strict backend parser, including keys with escaped quotes', () => {
    expect(hasDuplicateKeys('{"a":1,"b":{"a":2},"c":["a","a"]}')).toBe(false);
    expect(hasDuplicateKeys('{"a\\"b":1,"a\\"b":2}')).toBe(true);
    expect(hasDuplicateKeys('[{"x":1},{"x":2,"y":"}","x":3}]')).toBe(true);
    expect(() => parseStrictJson('{"kind":1,"kind":2}')).toThrow(SyntaxError);
  });

  it.each([
    ['unknown method', edited((r) => { r.methodVersion = 'proteinforge-candidates-v2'; })],
    ['seed zero', edited((r) => { r.parameters.seed = 0; })],
    ['length over 300', edited((r) => { r.parameters.length = 301; })],
    ['no active range', edited((r) => { r.parameters.gravy.enabled = false; })],
    ['lowercase candidate', edited((r) => { first(r.guided).sequence = first(r.guided).sequence.toLowerCase(); })],
    ['candidate length', edited((r) => { first(r.guided).sequence = 'ACDEF'; })],
    ['six candidates', edited((r) => { r.guided.candidates.push({ ...first(r.reference) }); })],
    ['missing descriptor', edited((r) => { Reflect.deleteProperty(first(r.guided).descriptors, 'gravy'); })],
    ['extra field', edited((r) => { Object.assign(r, { notes: '' }); })],
    ['evaluations over budget', edited((r) => { r.guided.evaluations = 1001; })],
    ['repeated key', defaultExport.replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "schemaVersion": 1,')],
  ])('rejects an exported result with %s', (_name, text) => {
    expect(readGeneratorResult(text)).toBeNull();
  });

  it('validates run metadata and selection against the stored candidates', async () => {
    const run = await createGeneratorRun(defaultExport, details);
    for (const change of [{ id: '0'.repeat(64).replace('0', 'g') }, { origin: 'design-service' }, { recordedAt: '2026-10-27T09:30:00' }, { appBuild: 'main' },
      { selection: { arm: 'guided', index: 5 } }, { selection: { arm: 'best', index: 0 } }, { notes: '' }]) {
      expect(generatorRunSchema.safeParse({ ...run, ...change }).success, JSON.stringify(change)).toBe(false);
    }
    expect(generatorRunSchema.safeParse({ ...run, selection: { arm: 'reference', index: 4 } }).success).toBe(true);
  });

  it('applies the exact byte limits and never shortens or drops runs', async () => {
    const padded = defaultExport + ' '.repeat(C.maxRunBytes - encoder.encode(defaultExport).byteLength);
    expect((await createGeneratorRun(padded, details)).resultJson).toBe(padded);
    await expect(createGeneratorRun(`${padded} `, details)).rejects.toEqual(new ApiError('generator-history-size'));
    const ten = await historyFixture(Array.from({ length: C.maxRuns }, (_, index) => exportWithSeed(index + 1)));
    expect(generatorHistoryRuns(ten)).toHaveLength(C.maxRuns);
    const extra = await createGeneratorRun(exportWithSeed(99), details);
    await expect(addGeneratorRun(ten, extra)).rejects.toEqual(new ApiError('generator-history-size'));
    expect(generatorHistoryRuns(ten)).toHaveLength(C.maxRuns);
    const document = JSON.stringify({ kind: C.kind, schemaVersion: C.schemaVersion, runs: [await createGeneratorRun(defaultExport, details)] });
    const exact = document + ' '.repeat(C.maxDocumentBytes - encoder.encode(document).byteLength);
    expect(generatorHistorySnapshotSchema.safeParse(await envelope(exact)).success).toBe(true);
    expect(generatorHistorySnapshotSchema.safeParse(await envelope(`${exact} `)).success).toBe(false);
    expect(generatorHistorySnapshotSchema.safeParse(await envelope(document + ' '.repeat(40_000))).success).toBe(false);
  });

  it('keeps identical runs once and removes the last run as no history', async () => {
    const history = await historyFixture();
    const same = await createGeneratorRun(defaultExport, { ...details, selection: { arm: 'reference', index: 1 } });
    const repeated = await addGeneratorRun(history, same);
    expect(repeated).toEqual({ history, added: false });
    const two = (await addGeneratorRun(history, await createGeneratorRun(maximumExport, details))).history;
    const one = await removeGeneratorRun(two, DEFAULT_EXPORT_SHA256);
    expect(one && generatorHistoryRuns(one).map((run: GeneratorRun) => run.id)).toEqual([MAXIMUM_EXPORT_SHA256]);
    expect(await removeGeneratorRun(two, 'f'.repeat(64))).toBe(two);
    expect(one && await removeGeneratorRun(one, MAXIMUM_EXPORT_SHA256)).toBeNull();
  });

  it('refuses envelopes with another version, extra fields or invalid documents', async () => {
    const history = await historyFixture();
    for (const value of [{ ...history, schemaVersion: 2 }, { ...history, extra: 1 }, await envelope('{}'), await envelope('{"kind":1,"kind":2}'),
      await envelope(JSON.stringify({ kind: C.kind, schemaVersion: 1, runs: [] }))]) {
      expect(generatorHistorySnapshotSchema.safeParse(value).success).toBe(false);
    }
  });
});
