/// <reference lib="webworker" />

import { drawProfile } from './drawProfile';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import { calculateProfile } from './profile';
import { calculatePropensities } from './chouFasman';
import type { ProfilePoint, HydropathyWindow } from './profile';
import { LocalizedError, localizedFailure } from '../../i18n/localized';
import { CHART_FONT, fontUrl } from '../../theme/fonts';

const context = self as DedicatedWorkerGlobalScope;
let canvas: OffscreenCanvas | null = null;
let chartStyle: ProfileRequest['style'] | null = null;
let previousProfile: { points: ProfilePoint[]; windowSize: HydropathyWindow } | null = null;
let viewport: { width: number; height: number; scale: number } | null = null;

/** Font faces belong to the worker, independently from the document's CSS. */
function initializeChartFont(): void {
  if (typeof FontFace === 'undefined' || !('fonts' in context) || !CHART_FONT) return;
  const face = new FontFace(CHART_FONT.family, `url(${fontUrl(CHART_FONT)})`, { weight: String(CHART_FONT.weight) });
  void face.load().then((loaded) => {
    context.fonts.add(loaded);
    if (canvas && previousProfile && chartStyle && viewport) {
      drawProfile(canvas, previousProfile.points, previousProfile.windowSize, viewport.width, viewport.height, viewport.scale, chartStyle);
    }
  }).catch(() => {
    // Keep calculated data available if the font cannot load or redraw; the catalogs stay out of the Worker.
    console.warn(new LocalizedError('errors.chartFontLoad').message);
  });
}

context.onmessage = (event: MessageEvent<ProfileRequest>) => {
  const request = event.data;
  if (request.type === 'initialize') {
    canvas = request.canvas;
    chartStyle = request.style;
    initializeChartFont();
    return;
  }
  try {
    chartStyle = request.style;
    viewport = { width: request.width, height: request.height, scale: request.scale };
    if (request.type === 'redraw') {
      if (canvas && previousProfile) {
        drawProfile(canvas, previousProfile.points, previousProfile.windowSize, request.width, request.height, request.scale, chartStyle);
      }
      return;
    }
    const points = calculateProfile(request.sequence, request.windowSize);
    previousProfile = { points, windowSize: request.windowSize };
    const propensities = calculatePropensities(request.sequence);
    if (canvas) {
      drawProfile(
        canvas,
        points,
        request.windowSize,
        request.width,
        request.height,
        request.scale,
        chartStyle,
      );
    }
    const response: ProfileResponse = { id: request.id, points, propensities };
    context.postMessage(response);
  } catch (error) {
    const response: ProfileResponse = {
      id: request.id,
      error: localizedFailure(error, 'errors.profileFailed'),
    };
    context.postMessage(response);
  }
};
