/// <reference lib="webworker" />

import { calculateDescriptors } from './descriptors';
import { translate } from '../../i18n/translate';
import type { DescriptorResponse, DescriptorRequest } from './messages';
import { WORKER_LOCALE } from '../../i18n/config';

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<DescriptorRequest>) => {
  const { id, sequence } = event.data;
  try {
    const response: DescriptorResponse = { id, result: calculateDescriptors(sequence) };
    context.postMessage(response);
  } catch (error) {
    const response: DescriptorResponse = {
      id,
      error: error instanceof Error ? error.message : translate(WORKER_LOCALE, 'descriptors.error'),
    };
    context.postMessage(response);
  }
};
