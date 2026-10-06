import type { TileRequest, TileResult } from './tile';
import type { MatrixName, AlignmentMode, AlignmentResult } from './gotoh';

/** Protocol between the UI and the coordinating worker. */
export type AlignmentRequest =
  | { type: 'start'; id: number; first: string; second: string; matrix: MatrixName; mode: AlignmentMode }
  | { type: 'cancel'; id: number };

export type AlignmentResponse =
  | { type: 'progress'; id: number; fraction: number }
  | { type: 'result'; id: number; result: AlignmentResult }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number; message: string };

/** Internal protocol for parallel tiles. */
export interface TileRequestMessage { id: number; tile: TileRequest }
export type TileResponseMessage = { id: number; tile: TileResult } | { id: number; error: string };
