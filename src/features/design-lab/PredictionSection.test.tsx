import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../../i18n';
import { spanish as es } from '../../i18n/es';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { predictionFixture } from '../../test/predictionFixture';
import { LabContext } from './context';
import type { LabState } from './context';
import { PredictionSection } from './PredictionSection';
import { checkPrediction } from './predictionWorker';
import { downloadLabFile } from './download';
import type { PredictionApi } from './predictionApi';
import type { StructurePrediction } from './prediction';

vi.mock('./predictionWorker',()=>({checkPrediction:vi.fn()}));
vi.mock('./LabProjectControls',()=>({LabProjectControls:()=>null}));
vi.mock('./download',()=>({downloadLabFile:vi.fn()}));
vi.mock('../structure/BackboneView',()=>({BackboneView:({label}:{label:string})=><div role="img" aria-label={label}/> }));
const id='a'.repeat(64);
const noop=():void=>undefined;
function state():LabState{return {dataset:null,drafts:{[id]:{sequence:'AAA',protectedPositions:[],history:[]}},activeId:id,selected:0,status:'ready',error:null,progress:null,dirty:false,exported:false,replaceable:true,revision:1,predictions:null,storePrediction:vi.fn().mockReturnValue(true),markSaved:noop,document:vi.fn(),openDocument:vi.fn(),openExample:noop,openFile:noop,cancel:noop,selectVariant:noop,selectResidue:noop,substitute:noop,protect:noop,undo:noop,restore:noop,save:noop};}
function tree(lab:LabState,api:PredictionApi,auth:AuthContextValue=signedInFixture){return <MemoryRouter><LocaleProvider locale="es"><AuthContext.Provider value={auth}><LabContext.Provider value={lab}><PredictionSection api={api}/></LabContext.Provider></AuthContext.Provider></LocaleProvider></MemoryRouter>;}
function consentAndSend():void{fireEvent.click(screen.getByRole('checkbox',{name:es['prediction.consent']}));fireEvent.click(screen.getByRole('button',{name:es['prediction.send']}));}
beforeEach(()=>{vi.resetAllMocks();vi.mocked(checkPrediction).mockImplementation(prediction=>Promise.resolve({prediction,keys:[],ca:[]}));});

it('requires fresh consent, passes only the exact draft and stores only a validated result',async()=>{
  const record=await predictionFixture(),api={predict:vi.fn().mockResolvedValue(record)},lab=state();render(tree(lab,api));
  expect(screen.getByRole('button',{name:es['prediction.send']})).toBeDisabled();expect(api.predict).not.toHaveBeenCalled();
  consentAndSend();await waitFor(()=>{expect(lab.storePrediction).toHaveBeenCalledWith(id,1,{prediction:record,keys:[],ca:[]});});
  expect(api.predict).toHaveBeenCalledWith('AAA',true,signedInFixture.session?.accessToken,expect.any(AbortSignal));
  expect(screen.getByRole('checkbox')).not.toBeChecked();expect(screen.getByRole('button',{name:es['prediction.send']})).toBeDisabled();
});
it.each(['edit','owner','cancel'] as const)('abandons a late response after %s',async(change)=>{
  const record=await predictionFixture();let resolve:((value:StructurePrediction)=>void)|undefined;
  const api={predict:vi.fn<PredictionApi['predict']>(()=>new Promise<StructurePrediction>(done=>{resolve=done;}))},lab=state(),view=render(tree(lab,api));consentAndSend();
  if(change==='cancel')fireEvent.click(screen.getByRole('button',{name:es['prediction.cancel']}));
  else if(change==='edit')view.rerender(tree({...lab,drafts:{[id]:{sequence:'AAR',protectedPositions:[],history:[]}}},api));
  else view.rerender(tree(lab,api,{...signedInFixture,status:'anonymous',session:null}));
  await act(async()=>{resolve?.(record);await Promise.resolve();await Promise.resolve();});
  expect(lab.storePrediction).not.toHaveBeenCalled();
  const signal=api.predict.mock.calls[0]?.[3];expect(signal?.aborted).toBe(true);
});
it('preserves the draft on provider failure and does not retry automatically',async()=>{
  const api={predict:vi.fn().mockRejectedValue(new Error('private provider body'))},lab=state();render(tree(lab,api));consentAndSend();
  expect(await screen.findByRole('alert')).toHaveTextContent(es['prediction.unavailable']);expect(api.predict).toHaveBeenCalledOnce();expect(lab.storePrediction).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();expect(screen.queryByText('private provider body')).not.toBeInTheDocument();
});
it('shows a revalidated saved result and downloads the exact original PDB',async()=>{
  const record=await predictionFixture(),lab=state();lab.predictions={[id]:record};render(tree(lab,{predict:vi.fn()}));
  expect(await screen.findByRole('img',{name:es['prediction.viewer']})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:es['prediction.download']}));expect(downloadLabFile).toHaveBeenCalledWith(record.pdb,expect.stringContaining('.pdb'),'chemical/x-pdb');
  expect(screen.getByText(es['prediction.scope'])).toBeVisible();
});
