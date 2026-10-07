/// <reference lib="webworker" />
import { loadFasta } from './loadFasta';
import { translate } from '../../i18n/translate';
import { fastaFileSchema } from './fastaFile';
import { WORKER_LOCALE } from '../../i18n/config';

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const result = fastaFileSchema.safeParse(event.data);
  if (!result.success) {
    self.postMessage({ type: 'error', message: result.error.issues[0]?.message ?? translate(WORKER_LOCALE, 'errors.invalidFasta') });
    return;
  }

  try {
    await loadFasta(result.data.stream(), (entries) => {
      self.postMessage({ type: 'entries', entries });
    });
    self.postMessage({ type: 'complete' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : translate(WORKER_LOCALE, 'errors.fastaRead');
    self.postMessage({ type: 'error', message });
  }
};
