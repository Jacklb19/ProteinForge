import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateTile } from './tile';
import { readFile } from 'node:fs/promises';

vi.mock('./wasm', async (importOriginal) => {
  const original = await importOriginal<typeof import('./wasm')>();
  return { ...original, initializeAlignmentWasm: async () => {
    const { default: init } = await import('../../../rust/alignment/pkg/proteinforge_alignment');
    await init({ module_or_path: await readFile('rust/alignment/pkg/proteinforge_alignment_bg.wasm') });
  } };
});
import type { AlignmentRequest, AlignmentResponse, TileRequestMessage, TileResponseMessage } from './messages';

interface MockContext {
  crossOriginIsolated: boolean;
  navigator: { hardwareConcurrency: number };
  onmessage: ((event: MessageEvent<AlignmentRequest>) => void) | null;
  postMessage: ReturnType<typeof vi.fn<(response: AlignmentResponse) => void>>;
}

class MockTileWorker {
  static instances: MockTileWorker[] = [];
  static fail = false;
  onmessage: ((event: MessageEvent<TileResponseMessage>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { MockTileWorker.instances.push(this); }
  postMessage(request: TileRequestMessage): void {
    queueMicrotask(() => {
      this.onmessage?.(new MessageEvent('message', { data: { id: request.id - 1, error: 'Old response' } }));
      const response: TileResponseMessage = MockTileWorker.fail
        ? { id: request.id, error: 'Tile failure' }
        : { id: request.id, tile: calculateTile(request.tile) };
      this.onmessage?.(new MessageEvent('message', { data: response }));
    });
  }
}

async function initialize(isolated: boolean): Promise<MockContext> {
  const context: MockContext = { crossOriginIsolated: isolated, navigator: { hardwareConcurrency: 4 }, onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal('self', context);
  vi.stubGlobal('Worker', MockTileWorker);
  const BrowserURL = URL;
  // The test loader supplies module paths rather than browser worker URLs.
  vi.stubGlobal('URL', class extends BrowserURL {
    constructor(input: string | URL) { super(input, 'http://localhost/'); }
  });
  await import('./alignment.worker');
  return context;
}

function send(context: MockContext, request: AlignmentRequest): void {
  context.onmessage?.(new MessageEvent('message', { data: request }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  MockTileWorker.instances = [];
  MockTileWorker.fail = false;
});

describe('alignment coordinating worker', () => {
  it('returns a result without shared memory support', async () => {
    const context = await initialize(false);
    send(context, { type: 'start', id: 1, first: 'ACDE', second: 'ACDE', matrix: 'BLOSUM62', mode: 'global' });
    await waitFor(() => { expect(context.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', id: 1 })); });
    const response = context.postMessage.mock.calls.map(([message]) => message).find((message) => message.type === 'result');
    expect(response?.type === 'result' && response.result.score).toBe(24);
    expect(MockTileWorker.instances).toHaveLength(0);
  });

  it('shares the traceback across tile workers and releases them after completion', async () => {
    const context = await initialize(true);
    send(context, { type: 'start', id: 2, first: 'A'.repeat(520), second: 'A'.repeat(520), matrix: 'BLOSUM62', mode: 'global' });
    await waitFor(() => { expect(context.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', id: 2 })); });
    const response = context.postMessage.mock.calls.map(([message]) => message).find((message) => message.type === 'result');
    expect(response?.type === 'result' && response.result.score).toBe(2080);
    expect(MockTileWorker.instances.length).toBeGreaterThan(1);
    for (const instance of MockTileWorker.instances) expect(instance.terminate).toHaveBeenCalledOnce();
  });

  it('rejects overlapping tasks and acknowledges cancellation', async () => {
    const context = await initialize(false);
    send(context, { type: 'start', id: 3, first: 'A'.repeat(600), second: 'A'.repeat(600), matrix: 'BLOSUM62', mode: 'local' });
    send(context, { type: 'start', id: 4, first: 'AC', second: 'AC', matrix: 'BLOSUM62', mode: 'global' });
    expect(context.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', id: 4 }));
    send(context, { type: 'cancel', id: 3 });
    await waitFor(() => { expect(context.postMessage).toHaveBeenCalledWith({ type: 'cancelled', id: 3 }); });
    expect(context.postMessage.mock.calls.some(([message]) => message.type === 'result')).toBe(false);
  });

  it('reports tile failures and releases the pool', async () => {
    const context = await initialize(true);
    MockTileWorker.fail = true;
    send(context, { type: 'start', id: 5, first: 'A'.repeat(520), second: 'A'.repeat(520), matrix: 'BLOSUM62', mode: 'global' });
    await waitFor(() => { expect(context.postMessage).toHaveBeenCalledWith({ type: 'error', id: 5, message: 'Tile failure' }); });
    for (const instance of MockTileWorker.instances) expect(instance.terminate).toHaveBeenCalledOnce();
  });
});
