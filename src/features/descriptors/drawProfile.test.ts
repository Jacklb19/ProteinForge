import { describe, expect, it, vi } from 'vitest';
import { drawProfile, referencesForWindow } from './drawProfile';
import type { ChartStyle } from './profileMessages';

const style: ChartStyle = {
  surface: 'white', text: 'black', curve: 'blue', reference: 'gray',
  font: '14px sans-serif', margin: 36, lineWidth: 2, referenceWidth: 1,
};

describe('profile drawing', () => {
  it('includes zero and the transmembrane threshold only for window 19', () => {
    expect(referencesForWindow(9)).toEqual([0]);
    expect(referencesForWindow(19)).toEqual([0, 1.6]);
  });

  it('draws both references and the profile with the supplied styles', () => {
    const context = {
      setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn<(text: string, x: number, y: number) => void>(),
      arc: vi.fn(), fill: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
    };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as OffscreenCanvas;
    drawProfile(canvas, [{ position: 10, value: 0.3 }, { position: 11, value: 1.8 }], 19, 400, 200, 2, style);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(context.fillText.mock.calls.map((llamada) => llamada[0])).toContain('1,6');
    expect(context.fillText.mock.calls.map((llamada) => llamada[0])).toContain('0');
    expect(context.strokeStyle).toBe(style.curve);
    expect(context.font).toBe(style.font);
  });
});
