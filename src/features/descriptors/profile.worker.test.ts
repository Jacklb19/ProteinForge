import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartStyle, ProfileResponse, ProfileRequest } from './profileMessages';

interface MockWorkerContext {
  onmessage: ((event: MessageEvent<ProfileRequest>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

const style: ChartStyle = {
  surface: 'white', text: 'black', curve: 'blue', reference: 'gray',
  font: '14px sans-serif', margin: 36, lineWidth: 2, referenceWidth: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('profile worker', () => {
  it('receives the canvas and returns complete profile points', async () => {
    const context: MockWorkerContext = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal('self', context);
    await import('./profile.worker');
    const drawing = {
      setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
    };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => drawing) } as unknown as OffscreenCanvas;
    context.onmessage?.(new MessageEvent('message', { data: { type: 'initialize', canvas, style } }));
    context.onmessage?.(new MessageEvent('message', {
      data: {
        type: 'calculate', id: 7, sequence: 'ACDEFGHIK', windowSize: 9,
        width: 400, height: 200, scale: 1, style,
      },
    }));
    const response = context.postMessage.mock.calls[0]?.[0] as ProfileResponse;
    expect(response.id).toBe(7);
    expect(response.points).toHaveLength(1);
    expect(response.propensities).toHaveLength(9);
    expect(response.points?.[0]?.position).toBe(5);
    expect(drawing.strokeStyle).toBe('blue');
  });
});
