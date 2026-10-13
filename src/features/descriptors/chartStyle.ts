import type { ChartStyle } from './profileMessages';
import { DEFAULT_LOCALE } from '../../i18n/config';

function positiveMeasure(value: string): number {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

/** Resolves CSS tokens on the main thread before passing them to the worker. */
export function getChartStyle(canvas: HTMLCanvasElement, locale: ChartStyle['locale'] = DEFAULT_LOCALE): ChartStyle {
  const root = getComputedStyle(document.documentElement);
  const chart = getComputedStyle(canvas);
  const token = (name: string): string => root.getPropertyValue(name).trim();
  return {
    locale,
    surface: token('--bg-canvas') || root.backgroundColor,
    text: token('--text-secondary') || root.color,
    curve: token('--chart-line') || root.color,
    above: token('--chart-above') || root.color,
    below: token('--chart-below') || root.color,
    areaOpacity: positiveMeasure(token('--opacity-chart-area')),
    reference: token('--chart-reference') || root.color,
    font: `${chart.fontWeight} ${chart.fontSize} ${chart.fontFamily}`,
    margin: positiveMeasure(token('--space-chart-inner')),
    lineWidth: positiveMeasure(token('--border-width-chart-line')),
    referenceWidth: positiveMeasure(token('--border-width-chart-reference')),
  };
}
