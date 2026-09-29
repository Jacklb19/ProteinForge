import type { Descriptors } from './descriptors';

/** Calculation request sent to the persistent worker. */
export interface DescriptorRequest {
  id: number;
  sequence: string;
}

/** Tagged response so calculations from earlier edits can be discarded. */
export type DescriptorResponse =
  | { id: number; result: Descriptors; error?: never }
  | { id: number; error: string; result?: never };
