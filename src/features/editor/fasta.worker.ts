/// <reference lib="webworker" />
import { loadFasta } from './loadFasta';
import { fastaFileSchema, fastaInputProblem } from './fastaFile';
import { localizedFailure } from '../../i18n/localized';

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const result = fastaFileSchema.safeParse(event.data);
  if (!result.success) {
    self.postMessage({ type: 'error', message: fastaInputProblem(event.data) });
    return;
  }

  try {
    await loadFasta(result.data.stream(), (entries) => {
      self.postMessage({ type: 'entries', entries });
    });
    self.postMessage({ type: 'complete' });
  } catch (error: unknown) {
    self.postMessage({ type: 'error', message: localizedFailure(error, 'errors.fastaRead') });
  }
};
