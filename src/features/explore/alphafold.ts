import { z } from 'zod';
import { ALPHAFOLD_API_URL, ALPHAFOLD_FILES_URL, MODEL_LOOKUP_TIMEOUT_MS } from './config';

/** Why a predicted model cannot be shown; provider details never reach the interface. */
export type ModelProblem = 'missing' | 'partial' | 'mismatch' | 'unavailable';
export class ModelError extends Error {
  constructor(readonly reason: ModelProblem) { super(reason); this.name = 'ModelError'; }
}

export interface PredictedModel {
  /** BinaryCIF coordinates, always under the provider's file host. */
  readonly url: string;
  readonly version: number;
  /** Mean per-residue confidence (pLDDT), 0–100. */
  readonly confidence: number;
}

const predictionSchema = z.object({
  bcifUrl: z.string().startsWith(ALPHAFOLD_FILES_URL).regex(/^[A-Za-z0-9:/._-]+\.bcif$/),
  latestVersion: z.number().int().positive(),
  globalMetricValue: z.number().min(0).max(100),
  sequence: z.string().min(1),
  sequenceStart: z.number().int().positive(),
  sequenceEnd: z.number().int().positive(),
});

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Looks up the predicted model of one UniProt accession. Only the accession travels, without credentials.
 * A model is accepted when it covers exactly the sequence on screen, so sequence positions are model positions.
 */
export async function findPredictedModel(accession: string, sequence: string, signal: AbortSignal, fetchImplementation: FetchLike = fetch): Promise<PredictedModel> {
  if (!/^[A-Z0-9]{6,10}$/.test(accession)) throw new ModelError('missing');
  let response: Response;
  try {
    response = await fetchImplementation(`${ALPHAFOLD_API_URL}${accession}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(MODEL_LOOKUP_TIMEOUT_MS)]), credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ModelError('unavailable');
  }
  if (response.status === 404) throw new ModelError('missing');
  if (!response.ok) throw new ModelError('unavailable');
  let document: unknown;
  try { document = await response.json(); } catch { throw new ModelError('unavailable'); }
  if (!Array.isArray(document)) throw new ModelError('unavailable');
  if (document.length === 0) throw new ModelError('missing');
  // Long proteins are published as overlapping fragments; none of them is the whole chain.
  if (document.length > 1) throw new ModelError('partial');
  const parsed = predictionSchema.safeParse(document[0]);
  if (!parsed.success) throw new ModelError('unavailable');
  const prediction = parsed.data;
  if (prediction.sequenceStart !== 1 || prediction.sequenceEnd !== sequence.length) throw new ModelError('partial');
  if (prediction.sequence !== sequence) throw new ModelError('mismatch');
  return { url: prediction.bcifUrl, version: prediction.latestVersion, confidence: prediction.globalMetricValue };
}
