/// <reference lib="webworker" />

import { drawProfile } from './drawProfile';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import { calculateProfile } from './profile';
import { calculatePropensities } from './chouFasman';

const context = self as DedicatedWorkerGlobalScope;
let canvas: OffscreenCanvas | null = null;
let chartStyle: ProfileRequest['style'] | null = null;

context.onmessage = (event: MessageEvent<ProfileRequest>) => {
  const request = event.data;
  if (request.type === 'initialize') {
    canvas = request.canvas;
    chartStyle = request.style;
    return;
  }
  try {
    chartStyle = request.style;
    const points = calculateProfile(request.sequence, request.windowSize);
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
      error: error instanceof Error ? error.message : 'No se pudo generar el perfil.',
    };
    context.postMessage(response);
  }
};
