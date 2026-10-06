/// <reference lib="webworker" />

import { drawProfile } from './drawProfile';
import { translate } from '../../i18n/translate';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import { calculateProfile } from './profile';
import { calculatePropensities } from './chouFasman';
import type { ProfilePoint, HydropathyWindow } from './profile';

const context = self as DedicatedWorkerGlobalScope;
let canvas: OffscreenCanvas | null = null;
let chartStyle: ProfileRequest['style'] | null = null;
let previousProfile: { points: ProfilePoint[]; windowSize: HydropathyWindow } | null = null;
let viewport: { width: number; height: number; scale: number } | null = null;

/** Font faces belong to the worker, independently from the document's CSS. */
function initializeChartFont(): void {
  if (typeof FontFace === 'undefined' || !('fonts' in context)) return;
  const face = new FontFace('IBM Plex Sans', 'url(/fonts/plex-sans-regular.woff2)', { weight: '400' });
  void face.load().then((loaded) => {
    context.fonts.add(loaded);
    if (canvas && previousProfile && chartStyle && viewport) {
      drawProfile(canvas, previousProfile.points, previousProfile.windowSize, viewport.width, viewport.height, viewport.scale, chartStyle);
    }
  }).catch(() => {
    // Keep calculated data available if the font cannot load or redraw.
    console.warn(translate('es', 'errors.chartFontLoad'));
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
      error: error instanceof Error ? error.message : translate('es', 'errors.profileFailed'),
    };
    context.postMessage(response);
  }
};
