export const GENERATOR_CONFIG = {
  version: 'proteinforge-candidates-v1', alphabet: 'ACDEFGHIKLMNPQRSTVWY',
  minLength: 5, maxLength: 300, minBudget: 100, maxBudget: 5000,
  maxSeed: 0xffffffff, retained: 5, minimumDistance: 0.1,
  initialTemperature: 1, finalTemperature: 0.01, batchSize: 50,
  minimumGravyScale: 0.01, minimumMassScale: 1, timeoutMs: 60_000,
  filename: 'proteinforge-candidates.json', downloadRevokeMs: 1000, referenceSalt: 0x9e3779b9,
} as const;
/** Accepted values of each number in the search form; the inputs, their messages and the checks read them here. */
export const GENERATOR_FIELD_BOUNDS = {
  length: { minimum: GENERATOR_CONFIG.minLength, maximum: GENERATOR_CONFIG.maxLength, step: 1 },
  budget: { minimum: GENERATOR_CONFIG.minBudget, maximum: GENERATOR_CONFIG.maxBudget, step: 1 },
  seed: { minimum: 1, maximum: GENERATOR_CONFIG.maxSeed, step: 1 },
  gravyMinimum: { minimum: -4.5, maximum: 4.5, step: 0.01 },
  gravyMaximum: { minimum: -4.5, maximum: 4.5, step: 0.01 },
  massMinimum: { minimum: 0.01, maximum: 100_000, step: 0.01 },
  massMaximum: { minimum: 0.01, maximum: 100_000, step: 0.01 },
} as const;
export type GeneratorNumberField = keyof typeof GENERATOR_FIELD_BOUNDS;
export const GENERATOR_REFERENCES = [
  'https://research.ibm.com/publications/optimization-by-simulated-annealing',
  'https://www.jstatsoft.org/article/view/v008i14',
  'https://web.expasy.org/protparam/',
] as const;

/** Number formats of the compact candidate rows. */
export const CANDIDATE_GRAVY_FORMAT = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;
export const CANDIDATE_MASS_FORMAT = { maximumFractionDigits: 0 } as const;

/** Saved generator runs inside a project (workspace schemaVersion 3); mirrors backend app/generator_history.py. */
export const GENERATOR_HISTORY_CONFIG = {
  kind: 'proteinforge-generator-history', schemaVersion: 1, envelopeVersion: 1, workspaceVersion: 3,
  maxDocumentBytes: 100_000, maxRunBytes: 10_000, maxRuns: 10, origin: 'local-generator',
  methodVersions: [GENERATOR_CONFIG.version], maxReferences: 10, maxReferenceLength: 500, maxRecordedAtLength: 64,
  arms: ['guided', 'reference'], appBuildPattern: /^[0-9a-f]{7,40}$/,
  // Interface: a longer chosen candidate shows this many residues; figures describe all of it.
  chosenPrefixResidues: 60, identifierShown: 12, bytesPerKilobyte: 1000,
} as const;
