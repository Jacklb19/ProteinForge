/// <reference lib="webworker" />
import { compareWithReference, validatePrediction } from './prediction';
import type { PredictionTask } from './predictionWorker';
self.onmessage = (event: MessageEvent<PredictionTask>): void => {
  const task = event.data;
  const work = task.type === 'validate' ? validatePrediction(task.prediction, task.sequence) : Promise.resolve().then(() => compareWithReference(task.reference, task.prediction));
  void work
    .then(result => { self.postMessage({result}); })
    .catch(() => { self.postMessage({error:true}); });
};
