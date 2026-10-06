import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DescriptorResponse, DescriptorRequest } from './messages';

interface MockWorkerContext {
  onmessage: ((event: MessageEvent<DescriptorRequest>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('descriptor worker', () => {
  it('returns the calculation and rejects invalid input at the boundary', async () => {
    const context: MockWorkerContext = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal('self', context);
    await import('./descriptors.worker');
    context.onmessage?.(new MessageEvent('message', { data: { id: 1, sequence: 'ACDE' } }));
    context.onmessage?.(new MessageEvent('message', { data: { id: 2, sequence: 'ACXDE' } }));
    const first = context.postMessage.mock.calls[0]?.[0] as DescriptorResponse;
    const second = context.postMessage.mock.calls[1]?.[0] as DescriptorResponse;
    expect(first.id).toBe(1);
    expect(first.result?.length).toBe(4);
    expect(second.id).toBe(2);
    expect(second.error).toMatch(/aminoácidos estándar/i);
  });
});
