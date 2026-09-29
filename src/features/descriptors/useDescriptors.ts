import { useEffect, useMemo, useRef, useState } from 'react';
import { splitStandardResidues, validateSequence } from '../editor/sequence';
import type { Descriptors } from './descriptors';
import type { DescriptorResponse, DescriptorRequest } from './messages';

/** Visible state of the latest calculation and its input. */
export interface DescriptorState {
  result: Descriptors | null;
  status: 'empty' | 'calculating' | 'current' | 'invalid' | 'error';
  error: string | null;
  excluded: number;
}

interface ReceivedResult { sequence: string; data: Descriptors }
interface ReceivedError { sequence: string; message: string }

/** Keeps one worker and discards results from earlier editor revisions. */
export function useDescriptors(text: string): DescriptorState {
  const validation = useMemo(() => validateSequence(text), [text]);
  const residues = useMemo(() => splitStandardResidues(validation.sequence), [validation.sequence]);
  const [lastResult, setLastResult] = useState<ReceivedResult | null>(null);
  const [currentError, setCurrentError] = useState<ReceivedError | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const latestRequest = useRef(0);
  const sentSequence = useRef('');

  useEffect(() => {
    try {
      const instance = new Worker(new URL('./descriptors.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<DescriptorResponse>) => {
        const response = event.data;
        if (response.id !== latestRequest.current) return;
        if (response.error) {
          setCurrentError({ sequence: sentSequence.current, message: response.error });
          return;
        }
        if (response.result) {
          setLastResult({ sequence: sentSequence.current, data: response.result });
        }
      };
      instance.onerror = () => { setWorkerError('El hilo de cálculo dejó de responder.'); };
    } catch {
      queueMicrotask(() => { setWorkerError('Este navegador no pudo iniciar el hilo de cálculo.'); });
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);

  useEffect(() => {
    const id = ++latestRequest.current;
    if (validation.invalidPositions.length > 0 || residues.standard.length === 0) return;
    sentSequence.current = validation.sequence;
    const request: DescriptorRequest = { id, sequence: residues.standard };
    worker.current?.postMessage(request);
  }, [validation, residues]);

  const result = lastResult?.data ?? null;
  if (validation.invalidPositions.length > 0) return { result, status: 'invalid', error: null, excluded: residues.excluded };
  if (residues.standard.length === 0) return { result: null, status: 'empty', error: null, excluded: residues.excluded };
  if (workerError) return { result, status: 'error', error: workerError, excluded: residues.excluded };
  if (currentError?.sequence === validation.sequence) {
    return { result, status: 'error', error: currentError.message, excluded: residues.excluded };
  }
  if (lastResult?.sequence === validation.sequence) {
    return { result, status: 'current', error: null, excluded: residues.excluded };
  }
  return { result, status: 'calculating', error: null, excluded: residues.excluded };
}
