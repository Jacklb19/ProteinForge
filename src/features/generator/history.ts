import { z } from 'zod';
import { ApiError } from '../api/errors';
import { sha256 } from '../design-lab/zip';
import { GENERATOR_CONFIG as G, GENERATOR_HISTORY_CONFIG as C } from './config';
import { searchParametersSchema } from './search';

const encoder = new TextEncoder();
const utf8Bytes = (text: string): number => encoder.encode(text).byteLength;
const hex64 = /^[a-f0-9]{64}$/;

/** True when an object in valid JSON text repeats a key; JSON.parse would silently keep the last one. */
export function hasDuplicateKeys(text: string): boolean {
  const stack: { keys: Set<string> | null; expectKey: boolean }[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const top = stack.at(-1);
    if (character === '{') stack.push({ keys: new Set(), expectKey: true });
    else if (character === '[') stack.push({ keys: null, expectKey: false });
    else if (character === '}' || character === ']') stack.pop();
    else if (character === ',' && top?.keys) top.expectKey = true;
    else if (character === '"') {
      let end = index + 1;
      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      if (top?.keys && top.expectKey) {
        const key = JSON.parse(text.slice(index, end + 1)) as string;
        if (top.keys.has(key)) return true;
        top.keys.add(key);
        top.expectKey = false;
      }
      index = end;
    }
  }
  return false;
}

/** JSON.parse that also rejects repeated keys, like the backend's strict parser. */
export function parseStrictJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  if (hasDuplicateKeys(text)) throw new SyntaxError('Duplicate field');
  return value;
}

const descriptorsSchema = z.strictObject({
  massDa: z.number(), isoelectricPoint: z.number(), instabilityIndex: z.number(), aliphaticIndex: z.number(), gravy: z.number(),
  length: z.number().int().min(1).max(G.maxLength),
});
const candidateSchema = z.strictObject({
  sequence: z.string().regex(/^[ACDEFGHIKLMNPQRSTVWY]+$/), descriptors: descriptorsSchema, loss: z.number().nonnegative(), satisfies: z.boolean(),
});
const armSchema = z.strictObject({
  evaluations: z.number().int().min(1), matchingEvaluations: z.number().int().nonnegative(), bestLoss: z.number().nonnegative(),
  candidates: z.array(candidateSchema).min(1).max(G.retained), minimumPairDistance: z.number().min(0).max(1).nullable(),
});

/** Shape of an exported search result; the values are checked, never recalculated. */
export const generatorResultSchema = z.strictObject({
  schemaVersion: z.literal(1), methodVersion: z.enum(C.methodVersions), parameters: searchParametersSchema,
  guided: armSchema, reference: armSchema,
  references: z.array(z.string().min(1).max(C.maxReferenceLength)).max(C.maxReferences),
}).superRefine((result, context) => {
  for (const name of C.arms) {
    const arm = result[name];
    const sequences = new Set(arm.candidates.map((candidate) => candidate.sequence));
    const consistent = arm.evaluations <= result.parameters.budget && arm.matchingEvaluations <= arm.evaluations
      && sequences.size === arm.candidates.length && (arm.minimumPairDistance === null) === (arm.candidates.length < 2)
      && arm.candidates.every((candidate) => candidate.sequence.length === result.parameters.length && candidate.descriptors.length === candidate.sequence.length);
    if (!consistent) context.addIssue({ code: 'custom', path: [name], message: 'Inconsistent arm' });
  }
});

/** The validated result of an exported run text, or null when it does not match the contract. */
export function readGeneratorResult(text: string): z.infer<typeof generatorResultSchema> | null {
  if (utf8Bytes(text) > C.maxRunBytes) return null;
  try {
    const parsed = generatorResultSchema.safeParse(parseStrictJson(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const selectionSchema = z.strictObject({ arm: z.enum(C.arms), index: z.number().int().nonnegative() });
export const generatorRunSchema = z.strictObject({
  id: z.string().regex(hex64), origin: z.literal(C.origin),
  recordedAt: z.iso.datetime({ offset: true }).refine((value) => value.length <= C.maxRecordedAtLength),
  appBuild: z.string().regex(C.appBuildPattern).nullable(), resultJson: z.string(), selection: selectionSchema.nullable(),
}).superRefine((run, context) => {
  const result = readGeneratorResult(run.resultJson);
  if (!result) context.addIssue({ code: 'custom', path: ['resultJson'], message: 'Invalid generator result' });
  else if (run.selection && run.selection.index >= result[run.selection.arm].candidates.length) context.addIssue({ code: 'custom', path: ['selection'], message: 'Selection outside arm' });
});

export const generatorHistoryDocumentSchema = z.strictObject({
  kind: z.literal(C.kind), schemaVersion: z.literal(C.schemaVersion), runs: z.array(generatorRunSchema).min(1).max(C.maxRuns),
}).refine((document) => new Set(document.runs.map((run) => run.id)).size === document.runs.length);

/** Envelope stored in the workspace. SHA-256 values are checked by verifyGeneratorHistory (asynchronous). */
export const generatorHistorySnapshotSchema = z.strictObject({
  schemaVersion: z.literal(C.envelopeVersion), documentJson: z.string(), documentSha256: z.string().regex(hex64),
}).superRefine((envelope, context) => {
  let valid = utf8Bytes(envelope.documentJson) <= C.maxDocumentBytes;
  try { valid &&= generatorHistoryDocumentSchema.safeParse(parseStrictJson(envelope.documentJson)).success; } catch { valid = false; }
  if (!valid) context.addIssue({ code: 'custom', path: ['documentJson'], message: 'Invalid generator history' });
});

export type GeneratorRun = z.infer<typeof generatorRunSchema>;
export type GeneratorRunSelection = z.infer<typeof selectionSchema>;
export type GeneratorHistorySnapshot = z.infer<typeof generatorHistorySnapshotSchema>;

const sha256Text = (text: string): Promise<string> => sha256(encoder.encode(text));

/** Runs of a validated envelope, in recording order. */
export function generatorHistoryRuns(envelope: GeneratorHistorySnapshot): GeneratorRun[] {
  return generatorHistoryDocumentSchema.parse(parseStrictJson(envelope.documentJson)).runs;
}

/** Checks the document hash and that each run id is the SHA-256 of its exact exported text. */
export async function verifyGeneratorHistory(envelope: GeneratorHistorySnapshot): Promise<boolean> {
  if (!generatorHistorySnapshotSchema.safeParse(envelope).success || await sha256Text(envelope.documentJson) !== envelope.documentSha256) return false;
  for (const run of generatorHistoryRuns(envelope)) if (await sha256Text(run.resultJson) !== run.id) return false;
  return true;
}

/** A run from the exact text the generator downloads; a larger export is refused, never shortened. */
export async function createGeneratorRun(resultJson: string, details: { recordedAt: string; appBuild: string | null; selection: GeneratorRunSelection | null }): Promise<GeneratorRun> {
  if (utf8Bytes(resultJson) > C.maxRunBytes) throw new ApiError('generator-history-size');
  const parsed = generatorRunSchema.safeParse({ id: await sha256Text(resultJson), origin: C.origin, ...details, resultJson });
  if (!parsed.success) throw new ApiError('validation');
  return parsed.data;
}

async function envelopeOf(runs: GeneratorRun[]): Promise<GeneratorHistorySnapshot | null> {
  if (!runs.length) return null;
  const documentJson = JSON.stringify({ kind: C.kind, schemaVersion: C.schemaVersion, runs });
  if (runs.length > C.maxRuns || utf8Bytes(documentJson) > C.maxDocumentBytes) throw new ApiError('generator-history-size');
  const envelope = { schemaVersion: C.envelopeVersion, documentJson, documentSha256: await sha256Text(documentJson) };
  if (!generatorHistorySnapshotSchema.safeParse(envelope).success) throw new ApiError('validation');
  return envelope;
}

/** Appends a run. Identical runs share an id and are kept once; over the limits nothing is dropped. */
export async function addGeneratorRun(history: GeneratorHistorySnapshot | null | undefined, run: GeneratorRun): Promise<{ history: GeneratorHistorySnapshot; added: boolean }> {
  const runs = history ? generatorHistoryRuns(history) : [];
  if (history && runs.some((item) => item.id === run.id)) return { history, added: false };
  const next = await envelopeOf([...runs, run]);
  if (!next) throw new ApiError('validation');
  return { history: next, added: true };
}

/** Removes one run by id; the last removal leaves no history (null). */
export async function removeGeneratorRun(history: GeneratorHistorySnapshot, id: string): Promise<GeneratorHistorySnapshot | null> {
  const runs = generatorHistoryRuns(history);
  if (!runs.some((run) => run.id === id)) return history;
  return envelopeOf(runs.filter((run) => run.id !== id));
}
