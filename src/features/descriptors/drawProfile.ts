import type { ChartStyle } from './profileMessages';
import type { ProfilePoint, HydropathyWindow } from './profile';
import { PROFILE_AXIS_FORMAT, PROFILE_MINIMUM_HALF_RANGE, PROFILE_REFERENCE_LINES } from './config';
import { profileX } from './chartGeometry';
import { languageTags } from '../../i18n/config';
import { LocalizedError } from '../../i18n/localized';

/** Scientific reference lines accompanying the curve. */
export function referencesForWindow(windowSize: HydropathyWindow): number[] {
  return [...PROFILE_REFERENCE_LINES[windowSize]];
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
  if (!context) throw new LocalizedError('errors.canvasContext');
  const numberFormat = new Intl.NumberFormat(languageTags[style.locale]);
  const axisFormat = new Intl.NumberFormat(languageTags[style.locale], PROFILE_AXIS_FORMAT);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = style.surface;
  context.fillRect(0, 0, width, height);
  if (points.length === 0) return;

  const references = referencesForWindow(windowSize);
  let minimum = Math.min(...references, -PROFILE_MINIMUM_HALF_RANGE);
  let maximum = Math.max(...references, PROFILE_MINIMUM_HALF_RANGE);
  for (const point of points) {
    if (point.value !== null) {
      minimum = Math.min(minimum, point.value);
      maximum = Math.max(maximum, point.value);
    }
  }
  const plotHeight = Math.max(1, height - 2 * style.margin);
  const first = points[0]?.position ?? 0;
  const last = points.at(-1)?.position ?? first;
  const axis = { first, last, width, margin: style.margin };
  const xFor = (position: number): number => profileX(position, axis);
  const yFor = (value: number): number => height - style.margin
    - ((value - minimum) / (maximum - minimum)) * plotHeight;

  context.font = style.font;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
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

  // Area between the curve and zero: one hue above, another below, so the sign reads at a glance.
  const zero = yFor(0);
  const runs: ProfilePoint[][] = [];
  for (const point of points) {
    if (point.value === null) { runs.push([]); continue; }
    if (runs.length === 0) runs.push([]);
    runs.at(-1)?.push(point);
  }
  const fillSide = (color: string, top: number, bottom: number): void => {
    context.save();
    context.beginPath();
    context.rect(0, top, width, Math.max(0, bottom - top));
    context.clip();
    context.globalAlpha = style.areaOpacity;
    context.fillStyle = color;
    for (const run of runs) {
      const start = run[0];
      const end = run.at(-1);
      if (!start || !end || run.length < 2) continue;
      context.beginPath();
      context.moveTo(xFor(start.position), zero);
      for (const point of run) context.lineTo(xFor(point.position), yFor(point.value ?? 0));
      context.lineTo(xFor(end.position), zero);
      context.closePath();
      context.fill();
    }
    context.restore();
  };
  fillSide(style.above, 0, zero);
  fillSide(style.below, zero, height);

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
  // Vertical extremes on the left edge; first and last plotted positions under the curve.
  context.fillStyle = style.text;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillText(axisFormat.format(maximum), style.referenceWidth, yFor(maximum));
  context.textBaseline = 'bottom';
  context.fillText(axisFormat.format(minimum), style.referenceWidth, yFor(minimum));
  context.fillText(numberFormat.format(first), xFor(first), height - style.referenceWidth);
  context.textAlign = 'right';
  context.fillText(numberFormat.format(last), xFor(last), height - style.referenceWidth);
}
