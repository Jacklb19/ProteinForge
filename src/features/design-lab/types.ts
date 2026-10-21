export interface LabResidueKey { chain: string; number: number; insertion: string }
export type Coordinates = [number, number, number];
export interface LabReference {
  id: string; chain: string; sequence: string; keys: LabResidueKey[]; ca: Coordinates[];
}
export interface LabVariant {
  id: string; sample: number; sequence: string; keys: LabResidueKey[];
  ca: Coordinates[]; alignedCa: Coordinates[]; plddt: number[];
  meanPlddt: number; ptm: number; rmsd: number; identicalPositions: number;
  /** Imported original PDB, never reconstructed from the Cα preview. */
  pdb: string | null;
  model: string; revision: string; designRevision: string;
  constraints?: {draftSha256:string;seedSequence:string;protectedPositions:number[]};
}
export interface LabDataset {
  id: string; source: 'example' | 'import'; reference: LabReference; variants: LabVariant[];
}
export interface LabDraftSnapshot { sequence: string; protectedPositions: number[] }
export interface LabDraft extends LabDraftSnapshot { history: LabDraftSnapshot[] }
export interface LabSavedState {
  activeId: string; selected: number; drafts: Record<string, LabDraftSnapshot>;
}
export interface LabImportResult {
  dataset: LabDataset; archive: ArrayBuffer | null; saved: LabSavedState | null;
}
export interface LabProgress { completed: number; total: number }
export type LabRequest =
  | { id: number; type: 'example' }
  | { id: number; type: 'import'; bytes: ArrayBuffer; expectedSha256?: string }
  | { id: number; type: 'export'; archive: ArrayBuffer | null; state: LabSavedState };
export type LabResponse =
  | { id: number; type: 'progress'; progress: LabProgress }
  | { id: number; type: 'result'; result: LabImportResult }
  | { id: number; type: 'export'; bytes: Uint8Array<ArrayBuffer> }
  | { id: number; type: 'error'; code: import('./config').LabErrorCode };
