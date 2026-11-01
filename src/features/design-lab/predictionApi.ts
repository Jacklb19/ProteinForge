import { FoldingService } from '../../gen/proteinforge/folding/v1/folding_service_pb';
import { ApiError, validated } from '../api/apiClient';
import { callOptions, createRpcClient, rpc } from '../api/rpc';
import { isoFromTimestamp } from '../api/timestamps';
import { foldingSequenceSchema, predictionSchema } from './prediction';
import { PREDICTION_CONFIG as C } from './predictionConfig';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
/** Only the configured ProteinForge API gets the session token. No direct provider call or retry. */
export function createPredictionApi(baseUrl: string, fetchImplementation?: FetchLike) {
  const client = createRpcClient(FoldingService, baseUrl, fetchImplementation);
  return {
    async predict(sequence: string, consent: boolean, token: string, signal?: AbortSignal) {
      if (!token.trim()) throw new ApiError('session');
      if (!consent) throw new ApiError('forbidden');
      if (!foldingSequenceSchema.safeParse(sequence).success) throw new ApiError('validation');
      const response = await rpc(() => client.predict({sequence, consentToSendSequence:true}, {...callOptions(signal,token),timeoutMs:C.requestTimeoutMs}));
      return validated(predictionSchema, {
        schemaVersion:response.schemaVersion, sequence:response.sequence, sequenceSha256:response.sequenceSha256,
        pdb:response.pdb, pdbSha256:response.pdbSha256, provider:response.provider, model:response.model,
        retrievedAt:isoFromTimestamp(response.retrievedAt),sourceUrl:response.sourceUrl,
        modelRevision:null,ptm:null,pae:null,confidence:null,
      });
    },
  };
}
export type PredictionApi = ReturnType<typeof createPredictionApi>;
