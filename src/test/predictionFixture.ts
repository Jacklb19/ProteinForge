/** Synthetic, nonbiological PDB used only by prediction regression tests. */
import { testPdb } from './design-lab-fixtures';
import { sha256 } from '../features/design-lab/zip';
import { PREDICTION_CONFIG as C } from '../features/design-lab/predictionConfig';
import type { StructurePrediction } from '../features/design-lab/prediction';
export async function predictionFixture(sequence='AAA'):Promise<StructurePrediction>{
  const pdb=testPdb(sequence),encode=(text:string):Uint8Array=>new TextEncoder().encode(text);
  return {schemaVersion:1,sequence,sequenceSha256:await sha256(encode(sequence)),pdb,pdbSha256:await sha256(encode(pdb)),provider:C.provider,model:C.model,modelRevision:null,retrievedAt:'2026-10-30T00:00:00Z',sourceUrl:C.sourceUrl,ptm:null,pae:null,confidence:null};
}
