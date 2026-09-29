/// <reference lib="webworker" />

import { calculateDescriptors } from './descriptors';
import type { DescriptorResponse, DescriptorRequest } from './messages';

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<DescriptorRequest>) => {
  const { id, sequence } = event.data;
  try {
    const response: DescriptorResponse = { id, result: calculateDescriptors(sequence) };
    context.postMessage(response);
  } catch (error) {
    const response: DescriptorResponse = {
      id,
      error: error instanceof Error ? error.message : 'No se pudieron calcular los descriptores.',
    };
    context.postMessage(response);
  }
};
