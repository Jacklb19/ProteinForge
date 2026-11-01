import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/errors';
import { toApiError } from '../api/rpc';
import { BackboneView } from '../structure/BackboneView';
import { useLab } from './context';
import { downloadLabFile } from './download';
import { LabProjectControls } from './LabProjectControls';
import { traceModel } from './presentation';
import { PREDICTION_CONFIG as C } from './predictionConfig';
import { checkPrediction } from './predictionWorker';
import type { StructurePrediction, ValidatedPrediction } from './prediction';
import type { PredictionApi } from './predictionApi';

function PredictionView({record}:{record:StructurePrediction}):React.JSX.Element {
  const {t,formatDate}=useTranslation();
  const [checked,setChecked]=useState<ValidatedPrediction|null>(null),[failed,setFailed]=useState(false);
  const [camera,setCamera]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void checkPrediction(record,record.sequence,controller.signal).then(value=>{if(!controller.signal.aborted)setChecked(value);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>{controller.abort();};
  },[record]);
  const model=useMemo(()=>checked ? traceModel(record.pdbSha256,record.sequence,checked.keys,checked.ca) : null,[record,checked]);
  return <section className="prediction-section" aria-labelledby="prediction-result-title">
    <h3 id="prediction-result-title">{t('prediction.result')}</h3>
    {failed ? <p role="alert">{t('prediction.invalid')}</p> : !model ? <p role="status">{t('prediction.validating')}</p> : <>
      <div className="lab-figure"><BackboneView key={camera} model={model} colorMode="chemistry" label={t('prediction.viewer')} describedBy="prediction-view-help" /></div>
      <p id="prediction-view-help" className="field-help">{t('prediction.viewInstructions')}</p>
      <p className="field-help">{t('prediction.trace')}</p>
      <div className="actions">
        <button type="button" className="button button-secondary" onClick={()=>{setCamera(value=>value+1);}}>{t('lab.resetView')}</button>
        <button type="button" className="button button-secondary" onClick={()=>{downloadLabFile(record.pdb,C.filename,'chemical/x-pdb');}}>{t('prediction.download')}</button>
        <LabProjectControls />
      </div>
    </>}
    <p className="field-help">{t('prediction.provenance',{provider:record.provider,model:record.model,time:formatDate(new Date(record.retrievedAt),{dateStyle:'medium',timeStyle:'short'})})}</p>
    <details className="disclosure"><summary>{t('prediction.hashes')}</summary><p className="prediction-sequence">{record.sequenceSha256}</p><p className="prediction-sequence">{record.pdbSha256}</p></details>
  </section>;
}

/** The key drops consent, in-flight requests and camera state when their subject or owner changes. */
export function PredictionSection({api}:{api?:PredictionApi}):React.JSX.Element {
  const lab=useLab(),auth=useAuth();
  const sequence=lab.drafts[lab.activeId]?.sequence??'';
  return <SessionPrediction key={`${String(lab.revision)}:${lab.activeId}:${sequence}:${auth.status==='signed-in'?auth.session?.user.id??'':'anonymous'}`} api={api} sequence={sequence} />;
}

function SessionPrediction({api,sequence}:{api?:PredictionApi;sequence:string}):React.JSX.Element {
  const lab=useLab(),auth=useAuth(),{t}=useTranslation();
  const [baseUrl]=useState(readApiBaseUrl);
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState<'cancelled'|'error'|null>(null);
  const [error,setError]=useState<ApiError|null>(null);
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>{pending.current?.abort();},[]);
  const record=lab.predictions?.[lab.activeId];
  const blocked=lab.status==='loading'||lab.status==='exporting';
  const signedIn=auth.status==='signed-in'&&Boolean(auth.session);
  const configured=Boolean(api||baseUrl);
  async function request():Promise<void>{
    const token=auth.session?.accessToken;
    if(!consent||!signedIn||!token||!configured||blocked||pending.current)return;
    const controller=new AbortController();pending.current=controller;setConsent(false);setBusy(true);setMessage(null);setError(null);
    try{
      const client=api??(await import('./predictionApi')).createPredictionApi(baseUrl??'');
      controller.signal.throwIfAborted();
      const result=await client.predict(sequence,true,token,controller.signal);
      const checked=await checkPrediction(result,sequence,controller.signal);
      if(controller.signal.aborted||pending.current!==controller)return;
      if(!lab.storePrediction(lab.activeId,lab.revision,checked))throw new ApiError('cancelled');
    }catch(failure){
      if(!controller.signal.aborted&&pending.current===controller){const safe=toApiError(failure);setError(safe);setMessage(safe.code==='cancelled'?'cancelled':'error');}
    }finally{if(pending.current===controller){pending.current=null;setBusy(false);}}
  }
  const failureKey=error?.code==='rate-limit'?'prediction.rateLimit':error?.code==='session'?'prediction.session':error?.code==='timeout'?'prediction.timeout':error?.code==='invalid-response'?'prediction.invalid':'prediction.unavailable';
  return <section className="prediction-section" aria-labelledby="prediction-title" aria-busy={busy}>
    <h2 id="prediction-title">{t('prediction.title')}</h2>
    <p>{t('prediction.introduction')}</p>
    <h3>{t('prediction.sequence')}</h3><p className="prediction-sequence">{sequence}</p>
    {!signedIn ? <p className="field-help">{t('prediction.session')} <Link className="button button-quiet" to={ROUTES.signIn} state={{from:ROUTES.laboratory}}>{t('shell.signIn')}</Link></p> : !configured ? <p className="notice">{t('prediction.config')}</p> : busy ? <>
      <p role="status">{t('prediction.busy')}</p>
      <div className="actions"><button type="button" className="button button-secondary" onClick={()=>{pending.current?.abort();pending.current=null;setBusy(false);setMessage('cancelled');}}>{t('prediction.cancel')}</button></div>
      <p className="field-help">{t('prediction.cancelScope')}</p>
    </> : <>
      <label className="checkbox-option"><input type="checkbox" checked={consent} disabled={blocked} onChange={event=>{setConsent(event.target.checked);}}/><span>{t('prediction.consent')}</span></label>
      <div className="actions"><button type="button" className="button button-primary" disabled={!consent||blocked} onClick={()=>{void request();}}>{t('prediction.send')}</button></div>
    </>}
    {message==='cancelled'&&<p role="status">{t('prediction.cancelled')}</p>}
    {message==='error'&&<p role="alert" className="status-message" data-state="error">{t(failureKey)}</p>}
    <p className="field-help">{t('prediction.limits')}</p><p className="field-help">{t('prediction.scope')}</p>
    {record&&<PredictionView key={`${record.pdbSha256}:${record.retrievedAt}`} record={record}/>}
  </section>;
}
