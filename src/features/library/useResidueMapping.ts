import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SequenceSource } from '../editor/source';
import { ApiError } from '../api/apiClient';
import { ResidueMappingError } from './mappingTypes';
import type { MappingLoader } from './mappingTypes';
import { createVerifiedResidueBinding } from './referenceBinding';
import type { ReferenceBindingStatus } from './referenceBinding';
import type { CoordinateResidue } from './residueMapping';

type Failure = 'error' | 'missing' | 'stale' | 'size' | 'limit' | 'session' | 'timeout' | 'unavailable';
type MappingReason = Failure | 'config' | 'version' | 'index' | 'coordinates' | 'loading' | 'ready';
interface Input { reference: SequenceSource; pdbId: string; token: string; load: MappingLoader | null }

/** Network, full-reference verification and coordinates have independent lifetimes. */
export function useResidueMapping({ reference, pdbId, token, load }: Input) {
  const [attempt, setAttempt] = useState(0);
  const scope = useMemo(() => ({ reference, pdbId, token, load, attempt }), [reference, pdbId, token, load, attempt]);
  const [response, setResponse] = useState<{ scope: typeof scope; data: unknown } | null>(null);
  const [failure, setFailure] = useState<{ scope: typeof scope; kind: Failure } | null>(null);
  const [coordinates, setCoordinates] = useState<{ pdbId: string; data: readonly CoordinateResidue[] } | null>(null);
  const [coordinateState, setCoordinateState] = useState<{ pdbId: string; reason: 'loading' | 'coordinates' | 'index' } | null>(null);
  const currentScope = useRef(scope);
  useLayoutEffect(() => { currentScope.current = scope; }, [scope]);

  useEffect(() => {
    if (!token || !load || reference.sequenceVersion === null) return;
    const operation = new AbortController(); let active = true;
    const request = { pdbId, accession: reference.accession, sequenceVersion: reference.sequenceVersion };
    // React can replace an effect before its first microtask (including StrictMode's rehearsal).
    // Cancel before acquisition so an obsolete mount does not spend a reference lookup.
    queueMicrotask(() => {
      if (!active || operation.signal.aborted) return;
      void load(request, token, operation.signal).then(data => {
        if (active && !operation.signal.aborted) setResponse({ scope, data });
      }).catch((error: unknown) => {
        if (!active || operation.signal.aborted) return;
        const kind: Failure = error instanceof ResidueMappingError ? error.reason === 'size' ? 'size' : 'stale'
          : error instanceof ApiError && error.code === 'not-found' ? 'missing'
            : error instanceof ApiError && error.code === 'rate-limit' ? 'limit'
              : error instanceof ApiError && error.code === 'session' ? 'session'
                : error instanceof ApiError && error.code === 'timeout' ? 'timeout'
                  : error instanceof ApiError && error.code === 'unavailable' ? 'unavailable' : 'error';
        setFailure({ scope, kind });
      });
    });
    return () => { active = false; operation.abort(); };
  }, [scope, token, load, pdbId, reference]);

  const data = response?.scope === scope ? response.data : null;
  const model = coordinates?.pdbId === pdbId ? coordinates : null;
  // Each reference/response/model snapshot owns a distinct binding, closed before paint on replacement.
  const snapshot = useMemo(() => ({ scope, data, model, binding: createVerifiedResidueBinding() }), [scope, data, model]);
  const binding = snapshot.binding;
  const [verified, setVerified] = useState<{ binding: typeof binding; status: ReferenceBindingStatus } | null>(null);
  useLayoutEffect(() => () => { binding.clear(); }, [binding]);
  useEffect(() => {
    if (!data || !model) return;
    const operation = new AbortController(); let active = true;
    const modelNum = model.data[0]?.modelNum;
    if (modelNum === undefined) return;
    void binding.bind(data, reference, { pdbId, coordinates: model.data }, modelNum, operation.signal).then(status => {
      if (active && status !== 'superseded') setVerified({ binding, status });
    }).catch(() => { if (active) setVerified({ binding, status: 'error' }); });
    return () => { active = false; operation.abort(); binding.clear(); };
  }, [binding, data, model, pdbId, reference]);

  const ready = verified?.binding === binding && verified.status === 'ready' && binding.status === 'ready';
  const reason: MappingReason = !token ? 'session' : !load ? 'config' : reference.sequenceVersion === null ? 'version'
    : failure?.scope === scope ? failure.kind
      : coordinateState?.pdbId === pdbId && coordinateState.reason !== 'loading' ? coordinateState.reason === 'index' ? 'index' : 'coordinates'
        : !data || !model ? 'loading'
          : !model.data.length ? 'index' : verified?.binding !== binding ? 'loading'
            : verified.status === 'ready' ? binding.chains.length ? 'ready' : 'missing'
              : verified.status === 'error' ? 'error' : 'stale';
  const onReady = useCallback((id: string, data: readonly CoordinateResidue[]) => {
    if (currentScope.current.pdbId !== id) return;
    setCoordinates({ pdbId: id, data }); setCoordinateState(null);
  }, []);
  const onUnavailable = useCallback((id: string, reason: 'loading' | 'coordinates' | 'index') => {
    if (currentScope.current.pdbId !== id) return;
    setCoordinates(null); setCoordinateState({ pdbId: id, reason });
  }, []);
  return { binding, ready, reason, modelNum: model?.data[0]?.modelNum, onReady, onUnavailable, retry: () => { setAttempt(value => value + 1); } };
}
