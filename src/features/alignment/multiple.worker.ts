/// <reference lib="webworker" />

import { alignMultiple } from './multiple';
import type { MultipleAlignment, MultipleEntry } from './multiple';
import type { MatrixName } from './config';
import { localizedFailure } from '../../i18n/localized';
import type { LocalizedText } from '../../i18n/localized';

export interface MultipleRequest { id: number; entries: MultipleEntry[]; matrix: MatrixName }
export type MultipleResponse =
  | { type: 'progress'; id: number; fraction: number }
  | { type: 'result'; id: number; result: MultipleAlignment }
  | { type: 'error'; id: number; message: LocalizedText };

const context = self as DedicatedWorkerGlobalScope;

/** One request at a time; the page cancels by ending the worker, so no partial result can arrive late. */
context.onmessage = (event: MessageEvent<MultipleRequest>) => {
  const { id, entries, matrix } = event.data;
  const post = (response: MultipleResponse): void => { context.postMessage(response); };
  void alignMultiple(entries, { matrix, onProgress: (fraction) => { post({ type: 'progress', id, fraction }); } })
    .then((result) => { post({ type: 'result', id, result }); })
    .catch((error: unknown) => { post({ type: 'error', id, message: localizedFailure(error, 'alignment.workerError') }); });
};
