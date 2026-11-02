/** Conservative opt-in; requires the matching backend and the local v4 migration before publication. */
export const PREDICTION_CONFIG = {
  enabledValue: 'enabled', schemaVersion: 1, workspaceVersion: 2,
  provider: 'esm-atlas', model: 'esmfold_v1',
  sourceUrl: 'https://api.esmatlas.com/foldSequence/v1/pdb/',
  minimumResidues: 3, maximumResidues: 120, maximumBytes: 1_000_000,
  maximumVariants: 3, maximumAtomsPerResidue: 64, maximumLineLength: 200,
  maximumCoordinate: 100_000, minimumPairedPositions: 3, rmsdDigits: 3, requestTimeoutMs: 40_000, workerTimeoutMs: 10_000,
  filename: 'proteinforge-esm-atlas.pdb',
} as const;
export const PREDICTION_PDB_RECORDS = new Set(['HEADER','TITLE','REMARK','COMPND','SOURCE','KEYWDS','EXPDTA','AUTHOR','REVDAT','JRNL','DBREF','SEQRES','CRYST1','ORIGX1','ORIGX2','ORIGX3','SCALE1','SCALE2','SCALE3','MODEL','ATOM','TER','ENDMDL','END','MASTER']);
export function predictionEnabled(environment: ImportMetaEnv = import.meta.env): boolean {
  return environment.VITE_STRUCTURE_PREDICTION === PREDICTION_CONFIG.enabledValue;
}
