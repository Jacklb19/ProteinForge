/// <reference lib="webworker" />
import { validatePrediction } from './prediction';
import type { StructurePrediction } from './prediction';
self.onmessage = (event: MessageEvent<{prediction:StructurePrediction;sequence:string}>): void => {
  void validatePrediction(event.data.prediction,event.data.sequence)
    .then(result => { self.postMessage({result}); })
    .catch(() => { self.postMessage({error:true}); });
};
