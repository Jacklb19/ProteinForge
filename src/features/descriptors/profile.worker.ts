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

context.onmessage = (event: MessageEvent<ProfileRequest>) => {
  const request = event.data;
  if (request.type === 'initialize') {
    canvas = request.canvas;
    chartStyle = request.style;
    return;
  }
  try {
    chartStyle = request.style;
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
