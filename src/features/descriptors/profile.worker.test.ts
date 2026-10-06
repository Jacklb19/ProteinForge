import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartStyle, ProfileResponse, ProfileRequest } from './profileMessages';

interface MockWorkerContext {
  onmessage: ((event: MessageEvent<ProfileRequest>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  fonts?: { add: ReturnType<typeof vi.fn> };
}

const style: ChartStyle = {
  locale: 'es',
  surface: 'white', text: 'black', curve: 'blue', reference: 'gray',
  font: '14px sans-serif', margin: 36, lineWidth: 2, referenceWidth: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('profile worker', () => {
  it('loads Plex in its font set and redraws without recalculating or publishing another result', async () => {
    const context: MockWorkerContext = { onmessage: null, postMessage: vi.fn(), fonts: { add: vi.fn() } };
    let finishLoading: ((face: object) => void) | undefined;
    const loading = new Promise<object>((resolve) => { finishLoading = resolve; });
    const fontArguments = vi.fn();
    class MockFontFace {
      constructor(...args: unknown[]) { fontArguments(...args); }
      load() { return loading; }
    }
    vi.stubGlobal('FontFace', MockFontFace);
    vi.stubGlobal('self', context);
    await import('./profile.worker');
    const drawing = {
      setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fillText: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    };
    const canvas = { getContext: () => drawing } as unknown as OffscreenCanvas;
    context.onmessage?.(new MessageEvent('message', { data: { type: 'initialize', canvas, style } }));
    context.onmessage?.(new MessageEvent('message', { data: {
      type: 'calculate', id: 1, sequence: 'ACDEFGHIK', windowSize: 9, width: 400, height: 200, scale: 1, style,
    } }));
    expect(drawing.fillRect).toHaveBeenCalledTimes(1);
    const loaded = {};
    finishLoading?.(loaded);
    await loading;
    expect(context.fonts?.add).toHaveBeenCalledWith(loaded);
    expect(fontArguments).toHaveBeenCalledWith('IBM Plex Sans', 'url(/fonts/plex-sans-regular.woff2)', { weight: '400' });
    expect(drawing.fillRect).toHaveBeenCalledTimes(2);
    expect(context.postMessage).toHaveBeenCalledOnce();
  });

  it('preserves results with an explicit warning when the chart font is unavailable', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      vi.stubGlobal('FontFace', class { load() { return Promise.reject(new Error('Font unavailable')); } });
      const context: MockWorkerContext = { onmessage: null, postMessage: vi.fn(), fonts: { add: vi.fn() } };
      vi.stubGlobal('self', context);
      await import('./profile.worker');
      const drawing = {
        setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
        stroke: vi.fn(), fillText: vi.fn(), arc: vi.fn(), fill: vi.fn(),
      };
      const canvas = { getContext: () => drawing } as unknown as OffscreenCanvas;
      context.onmessage?.(new MessageEvent('message', { data: { type: 'initialize', canvas, style } }));
      context.onmessage?.(new MessageEvent('message', { data: {
        type: 'calculate', id: 3, sequence: 'ACDEFGHIK', windowSize: 9, width: 400, height: 200, scale: 1, style,
      } }));
      await vi.waitFor(() => { expect(warning).toHaveBeenCalledOnce(); });
      expect((context.postMessage.mock.calls[0]?.[0] as ProfileResponse).points).toHaveLength(1);
      expect(context.fonts?.add).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });
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
    context.onmessage?.(new MessageEvent('message', {
      data: { type: 'redraw', id: 7, width: 400, height: 200, scale: 1, style: { ...style, curve: 'dark-curve' } },
    }));
    expect(drawing.strokeStyle).toBe('dark-curve');
    expect(context.postMessage).toHaveBeenCalledTimes(1);
  });
});
