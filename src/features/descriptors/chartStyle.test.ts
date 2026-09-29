import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { obtenerEstiloGrafica } from './chartStyle';

function canal(numero: number): number {
  const valor = numero / 255;
  return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((indice) => canal(Number.parseInt(hex.slice(indice, indice + 2), 16)));
  return 0.2126 * (canales[0] ?? 0) + 0.7152 * (canales[1] ?? 0) + 0.0722 * (canales[2] ?? 0);
}

function contraste(a: string, b: string): number {
  const primera = luminancia(a);
  const segunda = luminancia(b);
  return (Math.max(primera, segunda) + 0.05) / (Math.min(primera, segunda) + 0.05);
}

function token(css: string, nombre: string): string {
  const coincidencia = css.match(new RegExp(`${nombre}:\\s*(#[0-9a-fA-F]{6})`));
  if (!coincidencia?.[1]) throw new Error(`Falta el token ${nombre}.`);
  return coincidencia[1];
}

describe('estilos accesibles de la gráfica', () => {
  it('mantiene contraste AA en los tokens de texto, datos y referencias', () => {
    const css = readFileSync(resolve('src/design-tokens.css'), 'utf8');
    const superficie = token(css, '--color-surface');
    expect(contraste(token(css, '--color-text'), superficie)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(token(css, '--color-muted-text'), superficie)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(token(css, '--color-focus'), superficie)).toBeGreaterThanOrEqual(3);
    expect(contraste(token(css, '--color-border'), superficie)).toBeGreaterThanOrEqual(3);
  });

  it('lee colores y tipografía de CSS en el hilo principal', () => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--color-surface', '#ffffff');
    raiz.style.setProperty('--color-text', '#111827');
    raiz.style.setProperty('--color-focus', '#2563eb');
    raiz.style.setProperty('--color-border', '#6b7280');
    raiz.style.setProperty('--space-chart-inner', '36px');
    raiz.style.setProperty('--border-width-chart-line', '2px');
    raiz.style.setProperty('--border-width-chart-reference', '1px');
    const canvas = document.createElement('canvas');
    canvas.style.font = '14px Arial';
    const estilo = obtenerEstiloGrafica(canvas);
    expect(estilo.curva).toBe('#2563eb');
    expect(estilo.texto).toBe('#111827');
    expect(estilo.fuente).toContain('14px');
    expect(estilo.margen).toBe(36);
    raiz.removeAttribute('style');
  });
});
