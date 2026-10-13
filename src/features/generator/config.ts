export const GENERATOR_CONFIG = {
  version: 'proteinforge-candidates-v1', alphabet: 'ACDEFGHIKLMNPQRSTVWY',
  minLength: 5, maxLength: 300, minBudget: 100, maxBudget: 5000,
  maxSeed: 0xffffffff, retained: 5, minimumDistance: 0.1,
  initialTemperature: 1, finalTemperature: 0.01, batchSize: 50,
  minimumGravyScale: 0.01, minimumMassScale: 1, timeoutMs: 60_000,
  filename: 'proteinforge-candidates.json', referenceSalt: 0x9e3779b9,
} as const;
export const GENERATOR_REFERENCES = [
  'https://research.ibm.com/publications/optimization-by-simulated-annealing',
  'https://www.jstatsoft.org/article/view/v008i14',
  'https://web.expasy.org/protparam/',
] as const;

/** Number formats of the compact candidate rows. */
export const CANDIDATE_GRAVY_FORMAT = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;
export const CANDIDATE_MASS_FORMAT = { maximumFractionDigits: 0 } as const;
