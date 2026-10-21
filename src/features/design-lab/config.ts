import type { TranslationKey } from '../../i18n';

export const LAB_CONFIG = {
  schemaVersion: 1, exampleId: '1ubq-colab-20261021-v1',
  ubiquitinSequence: 'MQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG',
  maximumArchiveBytes: 10_000_000, maximumWorkspaceBytes: 15_000_000,
  maximumExpandedBytes: 24_000_000, maximumEntryBytes: 8_000_000,
  maximumEntries: 160, maximumPathLength: 180, maximumResidues: 120, maximumVariants: 3,
  maximumHistory: 50, sequenceBlock: 10, mobileColumns: 5, timeoutMs: 45_000, revokeUrlMs: 1000,
  rmsdTolerance: 0.000001, confidenceMeanTolerance: 0.00004, pdbConfidenceTolerance: 0.006,
  mpnnRevision: '8907e6671bfbfc92303b5f79c4b5e6ce47cdef57',
  foldingRevision: '75a3841ee059df2bf4d56688166c8fb459ddd97a',
  foldingModel: 'facebook/esmfold_v1',
  workspaceFilename: 'proteinforge-laboratory.json', constraintsFilename: 'proteinforge-design-draft.json',
} as const;

export const LAB_ERROR_KEYS = {
  size: 'lab.errorSize', zip: 'lab.errorZip', path: 'lab.errorPath', unsupported: 'lab.errorUnsupported',
  hash: 'lab.errorHash', schema: 'lab.errorSchema', incomplete: 'lab.errorIncomplete',
  sequence: 'lab.errorSequence', pdb: 'lab.errorPdb', confidence: 'lab.errorConfidence',
  comparison: 'lab.errorComparison', workspace: 'lab.errorWorkspace', worker: 'lab.errorWorker', timeout: 'lab.errorTimeout',
} as const satisfies Record<string, TranslationKey>;
export type LabErrorCode = keyof typeof LAB_ERROR_KEYS;
export class LabError extends Error {
  constructor(public readonly code: LabErrorCode) { super(code); }
}
export function ensure(condition: unknown, code: LabErrorCode): asserts condition {
  if (!condition) throw new LabError(code);
}
export function required<T>(value: T | null | undefined): T {
  ensure(value !== undefined && value !== null, 'schema'); return value;
}
