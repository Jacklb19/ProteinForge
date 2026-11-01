import { z } from 'zod';
import { ensure, LAB_CONFIG as C, LabError } from './config';
import { importArchive, loadExample } from './validate';
import { sha256 } from './zip';
import type { LabDataset, LabImportResult, LabProgress, LabSavedState } from './types';
import { validatePredictions } from './prediction';
import type { StructurePredictions } from './prediction';
import { PREDICTION_CONFIG } from './predictionConfig';

const draftSchema = z.object({ sequence: z.string().min(3).max(C.maximumResidues).regex(/^[ACDEFGHIKLMNPQRSTVWY]+$/), protectedPositions: z.array(z.number().int().min(0).max(C.maximumResidues-1)).max(C.maximumResidues) }).strict();
const stateSchema = z.object({ activeId: z.string().max(100), selected: z.number().int().min(0).max(C.maximumResidues-1), drafts: z.record(z.string().regex(/^[a-f0-9]{64}$/), draftSchema) }).strict();
const workspaceBase = z.object({ kind: z.literal('proteinforge-laboratory'),
  source: z.discriminatedUnion('type', [z.object({ type: z.literal('example'), id: z.literal(C.exampleId) }).strict(), z.object({ type: z.literal('archive'), sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().max(Math.ceil(C.maximumArchiveBytes/3)*4) }).strict()]), state: stateSchema,
}).strict();
const workspaceSchema = z.discriminatedUnion('schemaVersion', [workspaceBase.extend({schemaVersion:z.literal(C.schemaVersion)}), workspaceBase.extend({schemaVersion:z.literal(PREDICTION_CONFIG.workspaceVersion),predictions:z.unknown()})]);

export function validateSaved(dataset: LabDataset, value: unknown): LabSavedState {
  const parsed = stateSchema.safeParse(value); ensure(parsed.success, 'workspace'); const state = parsed.data;
  ensure(Object.keys(state.drafts).length === dataset.variants.length && dataset.variants.some(variant => variant.id === state.activeId && state.selected < variant.sequence.length), 'workspace');
  for (const variant of dataset.variants) {
    const draft = state.drafts[variant.id]; ensure(draft && draft.sequence.length === variant.sequence.length, 'workspace');
    ensure(draft.protectedPositions.every(index => index < variant.sequence.length) && new Set(draft.protectedPositions).size === draft.protectedPositions.length, 'workspace');
  }
  return state;
}
function toBase64(bytes: Uint8Array): string {
  const pieces: string[] = [];
  for (let index = 0; index < bytes.length; index += 16_384) pieces.push(String.fromCharCode(...bytes.subarray(index,index+16_384)));
  return btoa(pieces.join(''));
}
function fromBase64(text: string): ArrayBuffer {
  ensure(text.length > 0 && text.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(text), 'workspace');
  let binary:string;try{binary=atob(text);}catch{throw new LabError('workspace');}ensure(binary.length <= C.maximumArchiveBytes, 'size');
  const output = Uint8Array.from(binary, char => char.charCodeAt(0)); ensure(toBase64(output) === text, 'workspace'); return output.buffer;
}
export async function importLab(bytes: ArrayBuffer, progress: (value: LabProgress) => void): Promise<LabImportResult> {
  ensure(bytes.byteLength <= C.maximumWorkspaceBytes, 'size'); const prefix = new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
  if (prefix[0] === 0x50 && prefix[1] === 0x4b) return importArchive(bytes,progress);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { throw new LabError('workspace'); }
  const parsed = workspaceSchema.safeParse(value); ensure(parsed.success, 'workspace'); const workspace = parsed.data;
  let result: LabImportResult;
  if (workspace.source.type === 'example') result = await loadExample();
  else {
    const archive = fromBase64(workspace.source.base64); ensure(await sha256(new Uint8Array(archive)) === workspace.source.sha256, 'hash');
    result = await importArchive(archive,progress);
  }
  result.saved = validateSaved(result.dataset,workspace.state);
  if (workspace.schemaVersion === PREDICTION_CONFIG.workspaceVersion) result.predictions = await validatePredictions(workspace.predictions,result.saved);
  return result;
}
/** Reopen the original source before exporting: serialized presentation objects never bypass import validation. */
export async function exportWorkspace(archive: ArrayBuffer | null, state: LabSavedState, predictions?: StructurePredictions | null): Promise<Uint8Array<ArrayBuffer>> {
  const result = archive ? await importArchive(archive) : await loadExample();
  const saved = validateSaved(result.dataset,state);
  const source = archive ? { type: 'archive',sha256:await sha256(new Uint8Array(archive)),base64:toBase64(new Uint8Array(archive)) } : { type:'example',id:C.exampleId };
  const predicted = predictions == null ? null : await validatePredictions(predictions,saved);
  const bytes = new TextEncoder().encode(JSON.stringify({kind:'proteinforge-laboratory',schemaVersion:predicted === null ? C.schemaVersion : PREDICTION_CONFIG.workspaceVersion,source,state:saved,...(predicted === null ? {} : {predictions:predicted})}));
  ensure(bytes.length <= C.maximumWorkspaceBytes,'size'); return bytes;
}
