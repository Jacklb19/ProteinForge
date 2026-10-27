import { ApiError } from '../api/errors';
import { GENERATOR_CONFIG } from './config';
import { readGeneratorResult } from './history';
import type { ReproduceRequest, ReproduceResponse } from './messages';
import type { ReproductionResult } from './reproduce';
import type { SearchProgress } from './search';

type WorkerLike = Pick<Worker, 'postMessage' | 'terminate'> & { onmessage: ((event: MessageEvent<ReproduceResponse>) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
export interface ReproductionOptions {
  onProgress?: (progress: SearchProgress) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  createWorker?: () => WorkerLike;
}

const createReproductionWorker = (): WorkerLike => new Worker(new URL('./reproduce.worker.ts', import.meta.url), { type: 'module' });

/** Repeats one saved run in its own Worker; cancelling or timing out terminates it. Nothing saved is changed. */
export function startReproduction(resultJson: string, { onProgress, signal, timeoutMs = GENERATOR_CONFIG.timeoutMs, createWorker = createReproductionWorker }: ReproductionOptions = {}): Promise<ReproductionResult> {
  if (!readGeneratorResult(resultJson)) return Promise.reject(new ApiError('validation'));
  if (signal?.aborted) return Promise.reject(new ApiError('cancelled'));
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    const finish = (outcome: () => void): void => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate(); outcome();
    };
    const abort = (): void => { finish(() => { reject(new ApiError('cancelled')); }); };
    const timer = setTimeout(() => { finish(() => { reject(new ApiError('timeout')); }); }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => { finish(() => { reject(new ApiError('unknown')); }); };
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === 'progress') onProgress?.(message.progress);
      else if (message.type === 'result') finish(() => { resolve(message.result); });
      else finish(() => { reject(new ApiError('unknown')); });
    };
    worker.postMessage({ id: 1, resultJson } satisfies ReproduceRequest);
  });
}
