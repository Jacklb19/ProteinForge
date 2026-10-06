import type { ChartStyle } from './profileMessages';
import { translate } from '../../i18n/translate';
import type { ProfilePoint, HydropathyWindow } from './profile';

/** Scientific reference lines accompanying the curve. */
export function referencesForWindow(windowSize: HydropathyWindow): number[] {
  return windowSize === 19 ? [0, 1.6] : [0];
}

/** Draws the profile and reference lines on the canvas transferred to the worker. */
export function drawProfile(
  canvas: OffscreenCanvas,
  points: readonly ProfilePoint[],
  windowSize: HydropathyWindow,
  width: number,
  height: number,
  scale: number,
  style: ChartStyle,
): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error(translate('es', 'errors.canvasContext'));
  const numberFormat = new Intl.NumberFormat(style.locale === 'es' ? 'es-CO' : 'en-US');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = style.surface;
  context.fillRect(0, 0, width, height);
  if (points.length === 0) return;

  const references = referencesForWindow(windowSize);
  let minimum = Math.min(...references, -0.5);
  let maximum = Math.max(...references, 0.5);
  for (const point of points) {
    if (point.value !== null) {
      minimum = Math.min(minimum, point.value);
      maximum = Math.max(maximum, point.value);
    }
  }
  const plotWidth = Math.max(1, width - 2 * style.margin);
  const plotHeight = Math.max(1, height - 2 * style.margin);
  const first = points[0]?.position ?? 0;
  const last = points.at(-1)?.position ?? first;
  const xFor = (position: number): number => last === first
    ? width / 2
    : style.margin + ((position - first) / (last - first)) * plotWidth;
  const yFor = (value: number): number => height - style.margin
    - ((value - minimum) / (maximum - minimum)) * plotHeight;

  context.font = style.font;
  context.fillStyle = style.text;
  context.strokeStyle = style.reference;
  context.lineWidth = style.referenceWidth;
  for (const reference of references) {
    const y = yFor(reference);
    context.beginPath();
    context.moveTo(style.margin, y);
    context.lineTo(width - style.margin, y);
    context.stroke();
    context.fillText(numberFormat.format(reference), style.margin, y - style.referenceWidth);
  }

  context.strokeStyle = style.curve;
  context.lineWidth = style.lineWidth;
  context.beginPath();
  let strokeOpen = false;
  for (const point of points) {
    if (point.value === null) {
      strokeOpen = false;
      continue;
    }
    if (!strokeOpen) context.moveTo(xFor(point.position), yFor(point.value));
    else context.lineTo(xFor(point.position), yFor(point.value));
    strokeOpen = true;
  }
  context.stroke();
  if (points.length === 1 && points[0]?.value !== null) {
    context.beginPath();
    context.arc(xFor(first), yFor(points[0]?.value ?? 0), style.lineWidth * 2, 0, Math.PI * 2);
    context.fillStyle = style.curve;
    context.fill();
  }
  context.fillStyle = style.text;
  context.fillText(numberFormat.format(first), style.margin, height - style.referenceWidth);
  context.fillText(numberFormat.format(last), width - style.margin, height - style.referenceWidth);
}
