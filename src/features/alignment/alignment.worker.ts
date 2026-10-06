/// <reference lib="webworker" />

import { alignInTiles, TILE_SIZE } from './wavefront';
import { translate } from '../../i18n/translate';
import type { TileRequest, TileResult } from './tile';
import type { AlignmentRequest, AlignmentResponse, TileResponseMessage, TileRequestMessage } from './messages';

const context = self as DedicatedWorkerGlobalScope;
let active: { id: number; isCancelled: boolean } | null = null;

function executeTile(worker: Worker, tile: TileRequest, id: number): Promise<TileResult> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<TileResponseMessage>) => {
      if (event.data.id !== id) return;
      if ('error' in event.data) reject(new Error(event.data.error));
      else resolve(event.data.tile);
    };
    worker.onerror = () => { reject(new Error(translate('es', 'errors.workerStopped'))); };
    const request: TileRequestMessage = { id, tile };
    worker.postMessage(request);
  });
}

async function executeInPool(workers: Worker[], requests: TileRequest[], id: number): Promise<TileResult[]> {
  const responses: TileResult[] = [];
  for (let start = 0; start < requests.length; start += workers.length) {
    const batch = requests.slice(start, start + workers.length);
    const calculated = await Promise.all(batch.map((tile, index) => {
      const worker = workers[index];
      if (!worker) throw new Error(translate('es', 'errors.missingTileWorker'));
      return executeTile(worker, tile, id);
    }));
    responses.push(...calculated);
  }
  return responses;
}

context.onmessage = (event: MessageEvent<AlignmentRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    if (active?.id === request.id) active.isCancelled = true;
    return;
  }
  if (active) {
    const response: AlignmentResponse = { type: 'error', id: request.id, message: translate('es', 'errors.alignmentActive') };
    context.postMessage(response);
    return;
  }
  const task = { id: request.id, isCancelled: false };
  active = task;
  const canShare = typeof SharedArrayBuffer !== 'undefined' && context.crossOriginIsolated;
  const cores = Math.max(1, (context.navigator.hardwareConcurrency || 2) - 1);
  const parallelism = Math.min(cores, Math.ceil(Math.min(request.first.length, request.second.length) / TILE_SIZE));
  const workers = canShare && parallelism > 1
    ? Array.from({ length: parallelism }, () => new Worker(new URL('./tile.worker.ts', import.meta.url), { type: 'module' }))
    : [];
  const executeBatch = workers.length > 0
    ? (tiles: TileRequest[]) => executeInPool(workers, tiles, request.id)
    : undefined;
  void alignInTiles(request.first, request.second, {
    matrix: request.matrix,
    mode: request.mode,
    sharedMemory: workers.length > 0,
    executeBatch,
    isCancelled: () => task.isCancelled,
    onProgress: (fraction) => {
      const response: AlignmentResponse = { type: 'progress', id: task.id, fraction };
      context.postMessage(response);
    },
  }).then((result) => {
    const response: AlignmentResponse = task.isCancelled
      ? { type: 'cancelled', id: task.id }
      : { type: 'result', id: task.id, result };
    context.postMessage(response);
  }).catch((error: unknown) => {
    const response: AlignmentResponse = task.isCancelled
      ? { type: 'cancelled', id: task.id }
      : { type: 'error', id: task.id, message: error instanceof Error ? error.message : translate('es', 'alignment.workerError') };
    context.postMessage(response);
  }).finally(() => {
    workers.forEach((worker) => { worker.terminate(); });
    if (active === task) active = null;
  });
};
