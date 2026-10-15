/// <reference lib="webworker" />

import { calculateDescriptors } from './descriptors';
import type { DescriptorResponse, DescriptorRequest } from './messages';
import { localizedFailure } from '../../i18n/localized';

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<DescriptorRequest>) => {
  const { id, sequence } = event.data;
  try {
    const response: DescriptorResponse = { id, result: calculateDescriptors(sequence) };
    context.postMessage(response);
  } catch (error) {
    const response: DescriptorResponse = {
      id,
      error: localizedFailure(error, 'descriptors.error'),
    };
    context.postMessage(response);
  }
};
