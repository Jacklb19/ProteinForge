import { ApiError } from '../api/errors';
import { PREDICTION_CONFIG as C } from './predictionConfig';
import type { StructurePrediction, ValidatedPrediction } from './prediction';

/** A bounded, cancellable Worker; neither an aborted request nor a late message can resolve it. */
export function checkPrediction(prediction: StructurePrediction, sequence: string, signal: AbortSignal): Promise<ValidatedPrediction> {
  return new Promise((resolve,reject) => {
    if(signal.aborted){reject(new ApiError('cancelled'));return;}
    let worker:Worker;
    try {worker=new Worker(new URL('./prediction.worker.ts',import.meta.url),{type:'module'});}catch{reject(new ApiError('unavailable'));return;}
    let settled=false;
    const finish=(value:ValidatedPrediction|null,code:'cancelled'|'timeout'|'invalid-response'='invalid-response'):void=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();
      if(value)resolve(value);else reject(new ApiError(code));
    };
    const abort=():void=>{finish(null,'cancelled');};
    const timer=setTimeout(()=>{finish(null,'timeout');},C.workerTimeoutMs);
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>{finish(null);};
    worker.onmessage=(event:MessageEvent<{result?:ValidatedPrediction}>)=>{finish(event.data.result??null);};
    try{worker.postMessage({prediction,sequence});}catch{finish(null);}
  });
}
