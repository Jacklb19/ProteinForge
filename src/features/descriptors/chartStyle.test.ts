import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getChartStyle } from './chartStyle';

function channel(number: number): number {
  const value = number / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => channel(Number.parseInt(hex.slice(index, index + 2), 16)));
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const segunda = luminance(b);
  return (Math.max(first, segunda) + 0.05) / (Math.min(first, segunda) + 0.05);
}

function token(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`Falta el token ${name}.`);
  return match[1];
}

describe('accessible chart styles', () => {
  it('keeps AA contrast for text, data, and reference tokens', () => {
    const css = readFileSync(resolve('src/design-tokens.css'), 'utf8');
    const surface = token(css, '--color-surface');
    expect(contrast(token(css, '--color-text'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(css, '--color-muted-text'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(css, '--color-focus'), surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(token(css, '--color-border'), surface)).toBeGreaterThanOrEqual(3);
  });

  it('reads CSS colors and typography on the main thread', () => {
    const root = document.documentElement;
    root.style.setProperty('--color-surface', '#ffffff');
    root.style.setProperty('--color-text', '#111827');
    root.style.setProperty('--color-focus', '#2563eb');
    root.style.setProperty('--color-border', '#6b7280');
    root.style.setProperty('--space-chart-inner', '36px');
    root.style.setProperty('--border-width-chart-line', '2px');
    root.style.setProperty('--border-width-chart-reference', '1px');
    const canvas = document.createElement('canvas');
    canvas.style.font = '14px Arial';
    const style = getChartStyle(canvas);
    expect(style.curve).toBe('#2563eb');
    expect(style.text).toBe('#111827');
    expect(style.font).toContain('14px');
    expect(style.margin).toBe(36);
    root.removeAttribute('style');
  });
});
