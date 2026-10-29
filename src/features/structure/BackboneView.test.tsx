import { createHash } from 'node:crypto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESIDUE_CLASSES, RESIDUE_CLASS_TOKENS } from '../chemistry/config';
import { BackboneView } from './BackboneView';
import { INSULIN_BACKBONE } from './backbone';
import type { BackboneModel } from './backbone';

/** Every painted mark with the drawing state in effect when it was painted, so redundant state writes do not count. */
function recordingContext() {
  const marks: unknown[] = [];
  let path: number[][] = [];
  const state = {
    strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '', globalAlpha: 1,
    transform: [1, 0, 0, 1, 0, 0] as number[],
  };
  const context = {
    ...state,
    setTransform(...matrix: number[]) { context.transform = matrix; },
    clearRect(...rectangle: number[]) { marks.push({ clear: rectangle, transform: context.transform }); },
    beginPath() { path = []; },
    moveTo(x: number, y: number) { path.push([x, y]); },
    lineTo(x: number, y: number) { path.push([x, y]); },
    arc(...values: number[]) { path.push(values); },
    stroke() {
      marks.push({ stroke: path, style: context.strokeStyle, width: context.lineWidth, cap: context.lineCap, join: context.lineJoin, alpha: context.globalAlpha, transform: context.transform });
    },
    fillRect(...rectangle: number[]) { marks.push({ fillRect: rectangle, style: context.fillStyle, alpha: context.globalAlpha }); },
    fillText(text: string, x: number, y: number) { marks.push({ text, x, y, style: context.fillStyle, font: context.font, alpha: context.globalAlpha }); },
    // Deterministic advance per glyph; the real width depends on the font, which jsdom does not load.
    measureText(text: string) { return { width: text.length * 7 }; },
  };
  return { context, marks };
}

const digest = (marks: unknown[]): string => createHash('sha256').update(JSON.stringify(marks)).digest('hex').slice(0, 16);

const LIGHT: Record<string, string> = {
  '--bg-subtle': '#f3efe6', '--text-primary': '#1d1b17', '--residue-hydrophobic': '#b8752a', '--residue-polar': '#3f7d5a',
  '--residue-acidic': '#b03a48', '--residue-basic': '#2f5fa8', '--residue-special': '#7a6f63', '--residue-cysteine': '#c9a227',
};
const DARK: Record<string, string> = {
  '--bg-subtle': '#1f1d1a', '--text-primary': '#f1ece2', '--residue-hydrophobic': '#e0a35c', '--residue-polar': '#7cc49b',
  '--residue-acidic': '#ec7b88', '--residue-basic': '#83a9ec', '--residue-special': '#b3a99c', '--residue-cysteine': '#e8c75a',
};
const applyTokens = (tokens: Record<string, string>) => {
  for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(name, value);
};

/** A reference already superposed on the model, offset so its trace differs from the main one. */
const SHIFTED: BackboneModel = {
  ...INSULIN_BACKBONE,
  chains: INSULIN_BACKBONE.chains.map((chain) => ({ ...chain, residues: chain.residues.map((residue) => ({ ...residue, ca: residue.ca.map((value) => value + 0.8) })) })),
};

let recorder: ReturnType<typeof recordingContext>;

beforeEach(() => {
  expect(RESIDUE_CLASSES.every((name) => RESIDUE_CLASS_TOKENS[name] in LIGHT)).toBe(true);
  applyTokens(LIGHT);
  recorder = recordingContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => recorder.context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
  window.devicePixelRatio = 1;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
});

describe('BackboneView drawing', () => {
  it('paints the chemistry coloring with chain ends exactly as before', () => {
    render(<BackboneView label="Insulin" colorMode="chemistry" showEnds />);
    expect(recorder.marks.filter((mark) => 'clear' in (mark as object))).toHaveLength(1);
    expect(recorder.marks).toHaveLength(1524);
    expect(digest(recorder.marks)).toBe('55e60777a9c2b426');
  });

  it('paints hydropathy with a labeled selection exactly as before', () => {
    render(<BackboneView label="Insulin" colorMode="hydropathy" selected={{ chain: 'B', number: 24 }} selectedLabel="Phenylalanine B24" showEnds />);
    expect(digest(recorder.marks)).toBe('e65219c0e6eb34e4');
  });

  it('paints chains over a neutral reference at twice the pixel density exactly as before', () => {
    window.devicePixelRatio = 2;
    render(<BackboneView label="Variant" colorMode="chain" reference={SHIFTED} />);
    expect(digest(recorder.marks)).toBe('84db560f9e28c4f8');
  });

  it('turns with the keyboard and repaints the same frame as before', () => {
    render(<BackboneView label="Insulin" colorMode="chemistry" />);
    recorder.marks.length = 0;
    fireEvent.keyDown(screen.getByRole('group', { name: 'Insulin' }), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('group', { name: 'Insulin' }), { key: 'ArrowUp' });
    expect(digest(recorder.marks)).toBe('1e6052a42209c624');
  });

  it('reads the palette again when the theme changes', async () => {
    render(<BackboneView label="Insulin" colorMode="chemistry" showEnds />);
    recorder.marks.length = 0;
    applyTokens(DARK);
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      await Promise.resolve();
    });
    expect(recorder.marks.length).toBeGreaterThan(0);
    expect(digest(recorder.marks)).toBe('b65efac42f87b5f5');
  });
});
