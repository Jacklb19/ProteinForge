import { afterEach, expect, it, vi } from 'vitest';
import { checkPrediction } from './predictionWorker';
import { predictionFixture } from '../../test/predictionFixture';
import { PREDICTION_CONFIG as C } from './predictionConfig';

class WorkerStub {
  static latest:WorkerStub;
  onmessage:((event:MessageEvent)=>void)|null=null;
  onerror:(()=>void)|null=null;
  terminate=vi.fn();postMessage=vi.fn();
  constructor(){WorkerStub.latest=this;}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('terminates a cancelled Worker and rejects a later successful message',async()=>{
  vi.stubGlobal('Worker',WorkerStub);
  const record=await predictionFixture(),controller=new AbortController();
  const result=checkPrediction(record,'AAA',controller.signal).catch((error:unknown)=>error);
  const instance=WorkerStub.latest;controller.abort();
  instance.onmessage?.({data:{result:{prediction:record,keys:[],ca:[]}}} as MessageEvent);
  expect(await result).toMatchObject({code:'cancelled'});expect(instance.terminate).toHaveBeenCalledOnce();
});
it('bounds a silent Worker and handles worker failures without exposing data',async()=>{
  const record=await predictionFixture();vi.useFakeTimers();vi.stubGlobal('Worker',WorkerStub);
  const result=checkPrediction(record,'AAA',new AbortController().signal).catch((error:unknown)=>error);
  await vi.advanceTimersByTimeAsync(C.workerTimeoutMs);
  expect(await result).toMatchObject({code:'timeout'});expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();
  const bad=checkPrediction(record,'AAA',new AbortController().signal).catch((error:unknown)=>error);
  WorkerStub.latest.onerror?.();expect(await bad).toMatchObject({code:'invalid-response'});
});
it('never constructs an aborted Worker, and handles unavailable worker creation',async()=>{
  const record=await predictionFixture(),controller=new AbortController();controller.abort();
  const construct=vi.fn(function fail(){throw new Error('blocked');});vi.stubGlobal('Worker',construct);
  await expect(checkPrediction(record,'AAA',controller.signal)).rejects.toMatchObject({code:'cancelled'});expect(construct).not.toHaveBeenCalled();
  await expect(checkPrediction(record,'AAA',new AbortController().signal)).rejects.toMatchObject({code:'unavailable'});
});
