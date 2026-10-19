/// <reference lib="webworker" />

import { calculateWasmTile, initializeAlignmentWasm } from './wasm';
import type { TileRequestMessage, TileResponseMessage } from './messages';
import { localizedFailure } from '../../i18n/localized';

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = async (event: MessageEvent<TileRequestMessage>) => {
  try {
    await initializeAlignmentWasm();
    const tile = calculateWasmTile(event.data.tile);
    const response: TileResponseMessage = { id: event.data.id, tile };
    context.postMessage(response, [
      tile.bottom.m.buffer, tile.bottom.x.buffer, tile.bottom.y.buffer,
      tile.right.m.buffer, tile.right.x.buffer, tile.right.y.buffer,
    ]);
  } catch (error) {
    const response: TileResponseMessage = {
      id: event.data.id,
      error: localizedFailure(error, 'errors.tileFailed'),
    };
    context.postMessage(response);
  }
};
