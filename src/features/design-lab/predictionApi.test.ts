import { expect, it, vi } from 'vitest';
import { PredictRequestSchema, PredictResponseSchema } from '../../gen/proteinforge/folding/v1/folding_service_pb';
import { grpcWebError, grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { predictionFixture } from '../../test/predictionFixture';
import { createPredictionApi } from './predictionApi';

it('sends one consented exact sequence to the configured API and normalizes absent metrics',async()=>{
  const fixture=await predictionFixture();
  const fetcher=vi.fn().mockResolvedValue(grpcWebResponse(PredictResponseSchema,{...fixture, retrievedAt:{seconds:1793318400n,nanos:0}}));
  const api=createPredictionApi('https://api.example.org',fetcher);
  const result=await api.predict('AAA',true,'private-test-token');
  expect(result).toMatchObject({pdb:fixture.pdb,ptm:null,pae:null,confidence:null,modelRevision:null});
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://api.example.org/proteinforge.folding.v1.FoldingService/Predict');
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer private-test-token');
  expect(init.credentials).toBe('omit');expect(init.redirect).toBe('error');
  expect(grpcWebRequest(PredictRequestSchema,init.body)).toMatchObject({sequence:'AAA',consentToSendSequence:true});
});
it('rejects missing consent, session and noncanonical input before any request',async()=>{
  const fetcher=vi.fn(),api=createPredictionApi('https://api.example.org',fetcher);
  await expect(api.predict('AAA',false,'token')).rejects.toMatchObject({code:'forbidden'});
  await expect(api.predict('AAA',true,'')).rejects.toMatchObject({code:'session'});
  await expect(api.predict('AXA',true,'token')).rejects.toMatchObject({code:'validation'});
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([[8,'rate-limit'],[4,'timeout'],[16,'session'],[14,'unavailable']] as const)('does not retry RPC error %s',async(code,category)=>{
  const fetcher=vi.fn().mockResolvedValue(grpcWebError(code,'private upstream message'));
  await expect(createPredictionApi('https://api.example.org',fetcher).predict('AAA',true,'token')).rejects.toMatchObject({code:category,message:category});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
