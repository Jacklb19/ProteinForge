import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/apiClient';
import { readApiBaseUrl } from '../api/config';
import { useAuth } from '../auth/authContext';
import { createLibraryApi } from '../library/libraryApi';
import type { UniProtEntry } from '../library/libraryApi';
import { ModelError, findPredictedModel } from './alphafold';
import type { ModelProblem, PredictedModel } from './alphafold';

type EntryLoader = (accession: string, token: string, signal: AbortSignal) => Promise<UniProtEntry>;
type ModelFinder = (accession: string, sequence: string, signal: AbortSignal) => Promise<PredictedModel>;

export type EntryState =
  | { status: 'loading' }
  | { status: 'ready'; entry: UniProtEntry }
  | { status: 'error'; error: ApiError };
export type ModelState =
  | { status: 'loading' }
  | { status: 'ready'; model: PredictedModel }
  | { status: 'absent'; reason: ModelProblem };

interface Settled<Value> { key: string; value: Value }

/**
 * The reference entry of one accession and, once it is known, its predicted model. Each answer is kept
 * with the request it belongs to, so a protein left behind never shows under the next one.
 */
export function useProtein(accession: string, loaders: { entry?: EntryLoader | null; model?: ModelFinder } = {}): { entry: EntryState; model: ModelState; retryEntry: () => void; retryModel: () => void } {
  const auth = useAuth();
  const token = auth.status === 'signed-in' ? auth.session?.accessToken ?? '' : '';
  const client = useMemo(() => { const url = readApiBaseUrl(); return url ? createLibraryApi(url) : null; }, []);
  const loadEntry = useMemo<EntryLoader | null>(() => loaders.entry !== undefined ? loaders.entry
    : client ? (wanted, credential, signal) => client.detail(wanted, credential, signal) : null, [loaders.entry, client]);
  const findModel = loaders.model ?? findPredictedModel;
  const [entryAttempt, setEntryAttempt] = useState(0);
  const [modelAttempt, setModelAttempt] = useState(0);
  const [entryResult, setEntryResult] = useState<Settled<EntryState> | null>(null);
  const [modelResult, setModelResult] = useState<Settled<ModelState> | null>(null);
  const entryKey = `${accession}:${token ? 'session' : 'anonymous'}:${String(entryAttempt)}`;

  useEffect(() => {
    const controller = new AbortController();
    const settle = (value: EntryState): void => { if (!controller.signal.aborted) setEntryResult({ key: entryKey, value }); };
    if (!loadEntry || !token) {
      queueMicrotask(() => { settle({ status: 'error', error: new ApiError(token ? 'unknown' : 'session') }); });
    } else {
      loadEntry(accession, token, controller.signal).then(
        (entry) => { settle({ status: 'ready', entry }); },
        (failure: unknown) => { settle({ status: 'error', error: failure instanceof ApiError ? failure : new ApiError('unknown') }); },
      );
    }
    return () => { controller.abort(); };
  }, [accession, token, loadEntry, entryKey]);

  const entry: EntryState = entryResult?.key === entryKey ? entryResult.value : { status: 'loading' };
  const sequence = entry.status === 'ready' ? entry.entry.sequence : null;
  const modelKey = `${entryKey}:${String(modelAttempt)}`;

  useEffect(() => {
    if (sequence === null) return;
    const controller = new AbortController();
    const settle = (value: ModelState): void => { if (!controller.signal.aborted) setModelResult({ key: modelKey, value }); };
    findModel(accession, sequence, controller.signal).then(
      (model) => { settle({ status: 'ready', model }); },
      (failure: unknown) => { settle({ status: 'absent', reason: failure instanceof ModelError ? failure.reason : 'unavailable' }); },
    );
    return () => { controller.abort(); };
  }, [accession, sequence, findModel, modelKey]);

  const model: ModelState = modelResult?.key === modelKey ? modelResult.value : { status: 'loading' };
  const retryEntry = useCallback(() => { setEntryAttempt(value => value + 1); }, []);
  const retryModel = useCallback(() => { setModelAttempt(value => value + 1); }, []);
  return { entry, model, retryEntry, retryModel };
}
