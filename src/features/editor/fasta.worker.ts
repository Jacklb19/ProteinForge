/// <reference lib="webworker" />
import { loadFasta } from './loadFasta';
import { translate } from '../../i18n/translate';
import { fastaFileSchema } from './fastaFile';

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const result = fastaFileSchema.safeParse(event.data);
  if (!result.success) {
    self.postMessage({ type: 'error', message: result.error.issues[0]?.message ?? translate('es', 'errors.invalidFasta') });
    return;
  }

  try {
    await loadFasta(result.data.stream(), (entries) => {
      self.postMessage({ type: 'entries', entries });
    });
    self.postMessage({ type: 'complete' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : translate('es', 'errors.fastaRead');
    self.postMessage({ type: 'error', message });
  }
};
