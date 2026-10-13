import { describe, expect, it, vi } from 'vitest';
import { drawProfile, referencesForWindow } from './drawProfile';
import type { ChartStyle } from './profileMessages';

const style: ChartStyle = {
  locale: 'es',
  surface: 'white', text: 'black', curve: 'blue', above: 'orange', below: 'teal', areaOpacity: 0.4, reference: 'gray',
  font: '14px sans-serif', margin: 36, lineWidth: 2, referenceWidth: 1,
};

type Rectangle = [x: number, y: number, width: number, height: number];
interface Paint { fillStyle: string; strokeStyle: string; globalAlpha: number; clip: Rectangle | null }

/**
 * Canvas context that keeps the drawing state the way a real one does: `save` and `restore` scope
 * the styles and the clip region, and every fill and stroke records the state it was painted with.
 */
function drawingContext() {
  const saved: Paint[] = [];
  const fills: Paint[] = [];
  const strokes: Paint[] = [];
  let path: Rectangle | null = null;
  let clipRegion: Rectangle | null = null;
  const paint = (): Paint => ({ fillStyle: context.fillStyle, strokeStyle: context.strokeStyle, globalAlpha: context.globalAlpha, clip: clipRegion });
  const context = {
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 0, font: '', textAlign: '', textBaseline: '',
    setTransform: vi.fn(), fillRect: vi.fn(), closePath: vi.fn(), arc: vi.fn(),
    moveTo: vi.fn<(x: number, y: number) => void>(), lineTo: vi.fn<(x: number, y: number) => void>(),
    fillText: vi.fn<(text: string, x: number, y: number) => void>(),
    beginPath: vi.fn(() => { path = null; }),
    rect: vi.fn((...rectangle: Rectangle) => { path = rectangle; }),
    clip: vi.fn(() => { clipRegion = path; }),
    stroke: vi.fn(() => { strokes.push(paint()); }),
    fill: vi.fn(() => { fills.push(paint()); }),
    save: vi.fn(() => { saved.push(paint()); }),
    restore: vi.fn(() => {
      const previous = saved.pop();
      if (!previous) throw new Error('restore() was called without a matching save().');
      context.fillStyle = previous.fillStyle;
      context.strokeStyle = previous.strokeStyle;
      context.globalAlpha = previous.globalAlpha;
      clipRegion = previous.clip;
    }),
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as OffscreenCanvas;
  return { canvas, context, fills, strokes };
}

describe('profile drawing', () => {
  it('includes zero and the transmembrane threshold only for window 19', () => {
    expect(referencesForWindow(9)).toEqual([0]);
    expect(referencesForWindow(19)).toEqual([0, 1.6]);
  });

  it('draws both references and the profile with the supplied styles', () => {
    const { canvas, context, fills, strokes } = drawingContext();
    drawProfile(canvas, [{ position: 10, value: 0.3 }, { position: 11, value: 1.8 }], 19, 400, 200, 2, style);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(context.fillText.mock.calls.map((call) => call[0])).toContain('1,6');
    expect(context.fillText.mock.calls.map((call) => call[0])).toContain('0');
    expect(strokes.map((stroke) => stroke.strokeStyle)).toEqual([style.reference, style.reference, style.curve]);
    expect(strokes.at(-1)).toMatchObject({ globalAlpha: 1, clip: null });

    // The zero reference is the first line drawn; the area is filled above it with one color and below it with the other.
    const zero = context.moveTo.mock.calls[0]?.[1] ?? Number.NaN;
    expect(zero).toBeGreaterThan(style.margin);
    expect(zero).toBeLessThan(200 - style.margin);
    expect(fills).toEqual([
      { fillStyle: style.above, strokeStyle: style.reference, globalAlpha: style.areaOpacity, clip: [0, 0, 400, zero] },
      { fillStyle: style.below, strokeStyle: style.reference, globalAlpha: style.areaOpacity, clip: [0, zero, 400, 200 - zero] },
    ]);
    expect(context.save).toHaveBeenCalledTimes(2);
    expect(context.restore).toHaveBeenCalledTimes(2);
    expect(context.closePath).toHaveBeenCalledTimes(2);
    // Each filled shape starts and ends on the zero line, under the first and last plotted positions.
    expect(context.moveTo.mock.calls.filter(([x, y]) => x === style.margin && y === zero)).toHaveLength(3);
    expect(context.lineTo.mock.calls.filter(([x, y]) => x === 400 - style.margin && y === zero)).toHaveLength(3);
    expect(context.globalAlpha).toBe(1);

    context.fillText.mockClear();
    fills.length = 0;
    drawProfile(canvas, [{ position: 10, value: 0.3 }], 19, 400, 200, 1, { ...style, locale: 'en' });
    expect(context.fillText.mock.calls.map((call) => call[0])).toContain('1.6');
    expect(context.strokeStyle).toBe(style.curve);
    expect(context.font).toBe(style.font);
    // A single point has no area; it is drawn as an opaque dot in the curve color.
    expect(fills).toEqual([{ fillStyle: style.curve, strokeStyle: style.curve, globalAlpha: 1, clip: null }]);
    expect(context.arc).toHaveBeenCalledTimes(1);
  });

  it('fills every run of consecutive values separately and skips windows without data', () => {
    const { canvas, context, fills } = drawingContext();
    const points = [
      { position: 1, value: -1 }, { position: 2, value: -2 }, { position: 3, value: null },
      { position: 4, value: 1 }, { position: 5, value: 2 }, { position: 6, value: null }, { position: 7, value: 0.5 },
    ];
    drawProfile(canvas, points, 9, 400, 200, 1, style);
    expect(fills.map((fill) => fill.fillStyle)).toEqual([style.above, style.above, style.below, style.below]);
    expect(fills.every((fill) => fill.globalAlpha === style.areaOpacity && fill.clip !== null)).toBe(true);
    expect(context.closePath).toHaveBeenCalledTimes(4);
    expect(context.arc).not.toHaveBeenCalled();
  });
});
