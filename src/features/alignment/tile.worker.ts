/// <reference lib="webworker" />

import { calculateTile } from './tile';
import type { TileRequestMessage, TileResponseMessage } from './messages';

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<TileRequestMessage>) => {
  try {
    const tile = calculateTile(event.data.tile);
    const response: TileResponseMessage = { id: event.data.id, tile };
    context.postMessage(response, [
      tile.bottom.m.buffer, tile.bottom.x.buffer, tile.bottom.y.buffer,
      tile.right.m.buffer, tile.right.x.buffer, tile.right.y.buffer,
    ]);
  } catch (error) {
    const response: TileResponseMessage = {
      id: event.data.id,
      error: error instanceof Error ? error.message : 'Falló una tesela del alineamiento.',
    };
    context.postMessage(response);
  }
};
