import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlignmentInput } from './alignmentDraft';
import type { AlignmentResult } from './gotoh';
import type { AlignmentRequest, AlignmentResponse } from './messages';

export type AlignmentWorkerStatus = 'idle' | 'running' | 'cancelled' | 'error' | 'unavailable';

interface AlignmentWorker {
  status: AlignmentWorkerStatus;
  progress: number;
  /** Posts validated sequences; returns false when the worker could not be created. */
  start: (input: AlignmentInput) => boolean;
  cancel: () => void;
}

/** Owns one alignment worker for the lifetime of a component and discards answers to superseded requests. */
export function useAlignmentWorker(onResult: (result: AlignmentResult, input: AlignmentInput) => void): AlignmentWorker {
  const [status, setStatus] = useState<AlignmentWorkerStatus>('idle');
  const [progress, setProgress] = useState(0);
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const pending = useRef<AlignmentInput | null>(null);
  const deliver = useRef(onResult);
  useEffect(() => { deliver.current = onResult; }, [onResult]);

  useEffect(() => {
    try {
      const instance = new Worker(new URL('./alignment.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<AlignmentResponse>) => {
        const response = event.data;
        if (response.id !== requestId.current) return;
        if (response.type === 'progress') setProgress(response.fraction);
        if (response.type === 'result') {
          if (pending.current) deliver.current(response.result, pending.current);
          setStatus('idle');
        }
        if (response.type === 'cancelled') setStatus('cancelled');
        if (response.type === 'error') setStatus('error');
      };
      instance.onerror = () => { setStatus('error'); };
    } catch {
      queueMicrotask(() => { setStatus('unavailable'); });
    }
    return () => { worker.current?.terminate(); worker.current = null; };
  }, []);

  const start = useCallback((input: AlignmentInput): boolean => {
    if (!worker.current) { setStatus('unavailable'); return false; }
    pending.current = input;
    setProgress(0);
    setStatus('running');
    const request: AlignmentRequest = { type: 'start', id: ++requestId.current, first: input.first, second: input.second, matrix: input.matrix, mode: input.mode };
    worker.current.postMessage(request);
    return true;
  }, []);

  const cancel = useCallback((): void => {
    if (!worker.current) return;
    const request: AlignmentRequest = { type: 'cancel', id: requestId.current };
    worker.current.postMessage(request);
  }, []);

  return { status, progress, start, cancel };
}
