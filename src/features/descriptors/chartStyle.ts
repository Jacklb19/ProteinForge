import type { ChartStyle } from './profileMessages';

function positiveMeasure(value: string): number {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

/** Resolves CSS tokens on the main thread before passing them to the worker. */
export function getChartStyle(canvas: HTMLCanvasElement, locale: ChartStyle['locale'] = 'es'): ChartStyle {
  const root = getComputedStyle(document.documentElement);
  const chart = getComputedStyle(canvas);
  const token = (name: string): string => root.getPropertyValue(name).trim();
  return {
    locale,
    surface: token('--color-surface') || root.backgroundColor,
    text: token('--color-text') || root.color,
    curve: token('--color-focus') || root.color,
    reference: token('--color-border') || root.color,
    font: `${chart.fontWeight} ${chart.fontSize} ${chart.fontFamily}`,
    margin: positiveMeasure(token('--space-chart-inner')),
    lineWidth: positiveMeasure(token('--border-width-chart-line')),
    referenceWidth: positiveMeasure(token('--border-width-chart-reference')),
  };
}
