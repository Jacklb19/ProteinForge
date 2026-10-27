import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { compareResults, reproduceRun } from './reproduce';
import { startReproduction } from './reproduceClient';
import type { ReproductionOptions } from './reproduceClient';
import type { ReproduceResponse } from './messages';
import type { SearchResult } from './search';
import { defaultExport } from '../../test/generatorHistoryFixture';

describe('on-demand reproduction', () => {
  it('repeats the real default export byte for byte and reports progress', async () => {
    const progress = vi.fn();
    const saved = defaultExport;
    await expect(reproduceRun(saved, { progress })).resolves.toEqual({ status: 'identical', differences: [] });
    expect(progress).toHaveBeenLastCalledWith({ completed: 2000, total: 2000 });
    expect(saved).toBe(defaultExport);
  });

  it('distinguishes formatting from different values and names each differing path', async () => {
    await expect(reproduceRun(JSON.stringify(JSON.parse(defaultExport)))).resolves.toEqual({ status: 'equivalent', differences: [] });
    const changed = JSON.parse(defaultExport) as SearchResult;
    const candidate = changed.guided.candidates[0];
    if (!candidate) throw new Error('Fixture without candidates');
    changed.guided.candidates[0] = { ...candidate, loss: candidate.loss + 1 };
    changed.reference.matchingEvaluations += 1;
    await expect(reproduceRun(JSON.stringify(changed, null, 2))).resolves.toEqual({ status: 'different', differences: ['guided.candidates[0].loss', 'reference.matchingEvaluations'] });
    expect(compareResults(changed, changed)).toEqual([]);
  });

  it('stops between batches when cancelled and refuses text that is not a saved run', async () => {
    await expect(reproduceRun(defaultExport, { cancelled: () => true })).rejects.toThrow('Cancelled');
    await expect(reproduceRun('{}')).rejects.toEqual(new ApiError('validation'));
  });
});

class FakeWorker {
  onmessage: ((event: MessageEvent<ReproduceResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();
  send(data: ReproduceResponse): void { this.onmessage?.({ data } as MessageEvent<ReproduceResponse>); }
}
function client(options: Partial<ReproductionOptions> = {}) {
  const worker = new FakeWorker();
  const promise = startReproduction(defaultExport, { createWorker: () => worker, ...options });
  return { worker, promise };
}

describe('reproduction Worker client', () => {
  it('forwards progress, resolves the comparison and always terminates the Worker', async () => {
    const onProgress = vi.fn();
    const { worker, promise } = client({ onProgress });
    expect(worker.postMessage).toHaveBeenCalledWith({ id: 1, resultJson: defaultExport });
    worker.send({ id: 1, type: 'progress', progress: { completed: 50, total: 2000 } });
    worker.send({ id: 1, type: 'result', result: { status: 'different', differences: ['guided.bestLoss'] } });
    await expect(promise).resolves.toEqual({ status: 'different', differences: ['guided.bestLoss'] });
    expect(onProgress).toHaveBeenCalledWith({ completed: 50, total: 2000 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('cancels, times out and reports Worker failures as safe categories', async () => {
    const controller = new AbortController();
    const cancelled = client({ signal: controller.signal });
    controller.abort();
    await expect(cancelled.promise).rejects.toEqual(new ApiError('cancelled'));
    expect(cancelled.worker.terminate).toHaveBeenCalled();
    vi.useFakeTimers();
    try {
      const slow = client({ timeoutMs: 100 });
      vi.advanceTimersByTime(100);
      await expect(slow.promise).rejects.toEqual(new ApiError('timeout'));
      expect(slow.worker.terminate).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
    const failing = client();
    failing.worker.send({ id: 1, type: 'error' });
    await expect(failing.promise).rejects.toEqual(new ApiError('unknown'));
  });

  it('never starts a Worker for invalid text or an already cancelled request', async () => {
    const createWorker = vi.fn(() => new FakeWorker());
    await expect(startReproduction('{}', { createWorker })).rejects.toEqual(new ApiError('validation'));
    const controller = new AbortController(); controller.abort();
    await expect(startReproduction(defaultExport, { createWorker, signal: controller.signal })).rejects.toEqual(new ApiError('cancelled'));
    expect(createWorker).not.toHaveBeenCalled();
  });
});
