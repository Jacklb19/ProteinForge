import { ApiError } from '../api/errors';
import { PREDICTION_CONFIG as C } from './predictionConfig';
import type { PredictionComparison, StructurePrediction, ValidatedPrediction } from './prediction';
import type { Coordinates } from './types';

export type PredictionTask =
  | { type: 'validate'; prediction: StructurePrediction; sequence: string }
  | { type: 'compare'; reference: Coordinates[] | null; prediction: Coordinates[] };

/** A bounded, cancellable Worker; neither an aborted request nor a late message can resolve it. */
function runTask<T>(task: PredictionTask, signal: AbortSignal): Promise<T> {
  return new Promise((resolve,reject) => {
    if(signal.aborted){reject(new ApiError('cancelled'));return;}
    let worker:Worker;
    try {worker=new Worker(new URL('./prediction.worker.ts',import.meta.url),{type:'module'});}catch{reject(new ApiError('unavailable'));return;}
    let settled=false;
    const finish=(value:T|null,code:'cancelled'|'timeout'|'invalid-response'='invalid-response'):void=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();
      if(value)resolve(value);else reject(new ApiError(code));
    };
    const abort=():void=>{finish(null,'cancelled');};
    const timer=setTimeout(()=>{finish(null,'timeout');},C.workerTimeoutMs);
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>{finish(null);};
    worker.onmessage=(event:MessageEvent<{result?:T}>)=>{finish(event.data.result??null);};
    try{worker.postMessage(task);}catch{finish(null);}
  });
}

export function checkPrediction(prediction: StructurePrediction, sequence: string, signal: AbortSignal): Promise<ValidatedPrediction> {
  return runTask({type:'validate',prediction,sequence},signal);
}

/** Superposes an already validated prediction on the laboratory reference, off the main thread. */
export function measurePrediction(reference: Coordinates[] | null, prediction: Coordinates[], signal: AbortSignal): Promise<PredictionComparison> {
  return runTask({type:'compare',reference,prediction},signal);
}
