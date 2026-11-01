import { z } from 'zod';
import { ensure } from './config';
import { parsePdb } from './geometry';
import { sha256 } from './zip';
import { PREDICTION_CONFIG as C, PREDICTION_PDB_RECORDS } from './predictionConfig';
import type { Coordinates, LabResidueKey, LabSavedState } from './types';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const foldingSequenceSchema = z.string().min(C.minimumResidues).max(C.maximumResidues).regex(/^[ACDEFGHIKLMNPQRSTVWY]+$/);
export const predictionSchema = z.object({
  schemaVersion: z.literal(C.schemaVersion), sequence: foldingSequenceSchema, sequenceSha256: hash,
  pdb: z.string().min(1).max(C.maximumBytes), pdbSha256: hash,
  provider: z.literal(C.provider), model: z.literal(C.model), modelRevision: z.null(),
  sourceUrl: z.literal(C.sourceUrl), retrievedAt: z.iso.datetime({offset:true}),
  ptm: z.null(), pae: z.null(), confidence: z.null(),
}).strict();
export type StructurePrediction = z.infer<typeof predictionSchema>;
export type StructurePredictions = Record<string, StructurePrediction>;
export interface ValidatedPrediction { prediction: StructurePrediction; ca: Coordinates[]; keys: LabResidueKey[] }

/** Runs in the import/prediction Worker, before any downloaded PDB becomes a view or saved result. */
export async function validatePrediction(value: unknown, sequence: string): Promise<ValidatedPrediction> {
  const parsed = predictionSchema.safeParse(value); ensure(parsed.success, 'schema');
  const prediction = parsed.data;
  ensure(prediction.sequence === sequence, 'sequence');
  const bytes = new TextEncoder().encode(prediction.pdb);
  ensure(bytes.length <= C.maximumBytes && !prediction.pdb.includes('\0'), 'size');
  ensure(await sha256(bytes) === prediction.pdbSha256 && await sha256(new TextEncoder().encode(sequence)) === prediction.sequenceSha256, 'hash');
  let models = 0, ended = false;
  const counts = new Map<string,number>();
  for (const line of prediction.pdb.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const record = line.slice(0,6).trim();
    ensure(PREDICTION_PDB_RECORDS.has(record) && line.length <= C.maximumLineLength, 'pdb');
    if (record === 'MODEL') { models++; ensure(models === 1 && !ended, 'pdb'); }
    if (record === 'END' || record === 'ENDMDL') ended = true;
    if (record === 'ATOM') {
      // Match the geometry parser's canonical prefix; no recognized atom may
      // disappear from the second pass while remaining in the downloadable PDB.
      ensure(!ended && line.startsWith('ATOM  ') && line.length >= 66, 'pdb');
      // Every atom's B field must be finite, but no confidence scale is assigned to it.
      ensure(line.slice(60,66).trim() && Number.isFinite(Number(line.slice(60,66))), 'pdb');
      const key=line.slice(21,27),count=(counts.get(key)??0)+1;
      ensure(count<=C.maximumAtomsPerResidue,'size');counts.set(key,count);
    }
  }
  const geometry = parsePdb(prediction.pdb, 'A', sequence);
  ensure(geometry.atomCount <= sequence.length * C.maximumAtomsPerResidue, 'size');
  return { prediction, ca: geometry.ca, keys: geometry.keys };
}

export async function validatePredictions(value: unknown, state: LabSavedState): Promise<StructurePredictions> {
  const parsed = z.record(hash, predictionSchema).safeParse(value); ensure(parsed.success, 'workspace');
  ensure(Object.keys(parsed.data).length <= C.maximumVariants, 'workspace');
  for (const [id, prediction] of Object.entries(parsed.data)) {
    const draft = state.drafts[id]; ensure(draft, 'workspace');
    await validatePrediction(prediction, draft.sequence);
  }
  return parsed.data;
}
