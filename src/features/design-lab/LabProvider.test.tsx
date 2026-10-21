import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {LabProvider} from './LabProvider';
import {draftFingerprint,initialDrafts} from './state';
import {useLab} from './context';
import {loadExample} from './validate';
import {downloadLabFile} from './download';
import {LAB_CONFIG as C,required} from './config';
import type {LabImportResult,LabRequest,LabResponse} from './types';

vi.mock('./download',()=>({downloadLabFile:vi.fn()}));
class FakeWorker {
  static instances:FakeWorker[]=[];
  onmessage:((event:MessageEvent<LabResponse>)=>void)|null=null;
  onerror:(()=>void)|null=null;
  requests:LabRequest[]=[];terminate=vi.fn();
  constructor(){FakeWorker.instances.push(this);}
  postMessage(request:LabRequest):void{this.requests.push(request);}
  reply(response:Omit<Extract<LabResponse,{type:'result'}>,'id'>|Omit<Extract<LabResponse,{type:'error'}>,'id'>|Omit<Extract<LabResponse,{type:'progress'}>,'id'>|Omit<Extract<LabResponse,{type:'export'}>,'id'>):void{this.onmessage?.({data:{...response,id:required(this.requests.at(-1)).id}} as MessageEvent<LabResponse>);}
}
let example:LabImportResult;
let cloudDocument:Promise<Uint8Array<ArrayBuffer>|null>|null=null;
let cloudOpen:Promise<number|null>|null=null;
beforeAll(async()=>{example=await loadExample();});
beforeEach(()=>{FakeWorker.instances=[];vi.stubGlobal('Worker',FakeWorker);vi.mocked(downloadLabFile).mockReset();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function Harness({file}:{file?:File}):React.JSX.Element {
  const lab=useLab();return <><output data-testid="state">{JSON.stringify({dataset:lab.dataset?.id,status:lab.status,error:lab.error,dirty:lab.dirty,selected:lab.selected,active:lab.activeId,sequence:lab.drafts[lab.activeId]?.sequence,progress:lab.progress,exported:lab.exported,revision:lab.revision})}</output><button onClick={()=>{cloudDocument=lab.document();}}>cloud document</button><button onClick={()=>{cloudOpen=lab.openDocument(new ArrayBuffer(3),"a".repeat(64));}}>cloud open</button><button onClick={()=>{lab.markSaved(draftFingerprint(initialDrafts(example.dataset,null)));}}>mark original saved</button><button onClick={lab.openExample}>example</button><button onClick={()=>{if(file)lab.openFile(file);}}>file</button><button onClick={()=>{lab.substitute('A');}}>edit</button><button onClick={lab.protect}>protect</button><button onClick={lab.undo}>undo</button><button onClick={lab.restore}>restore</button><button onClick={lab.cancel}>cancel</button><button onClick={lab.save}>save</button><button onClick={()=>{lab.selectResidue(2);}}>position</button><button onClick={()=>{lab.selectResidue(-1);lab.selectVariant('missing');}}>invalid</button><button onClick={()=>{lab.selectVariant(required(example.dataset.variants[1]).id);}}>variant2</button><button onClick={()=>{lab.selectVariant(required(example.dataset.variants[0]).id);}}>variant1</button></>;
}
function click(name:string):void{fireEvent.click(screen.getByRole('button',{name}));}
function latest():FakeWorker{return required(FakeWorker.instances.at(-1));}
function mount(file?:File):void{render(<LabProvider><Harness file={file}/></LabProvider>);}
function ready(file?:File):void{mount(file);click('example');act(()=>{latest().reply({type:'result',result:example});});}
function state():{status:string;error:string|null;dirty:boolean;sequence:string;selected:number;dataset:string;exported:boolean;progress:unknown;revision:number}{return JSON.parse(screen.getByTestId('state').textContent) as ReturnType<typeof state>;}
function inputFile(read:()=>Promise<ArrayBuffer>=()=>Promise.resolve(new ArrayBuffer(3))):File{const file=new File(['abc'],'result.zip');Object.defineProperty(file,'arrayBuffer',{value:read});return file;}

describe('laboratory lifetime and atomic imports',()=>{
  it('retains every variant draft and the selected sequence position',()=>{ready();click('edit');const changed=state().sequence;expect(state().dirty).toBe(true);click('position');click('variant2');expect(state().selected).toBe(2);expect(state().sequence).toBe(required(example.dataset.variants[1]).sequence);click('variant1');expect(state().sequence).toBe(changed);click('invalid');expect(state().selected).toBe(2);});
  it('undoes back to the saved baseline and removes the unload warning',()=>{ready();click('edit');const warned=new Event('beforeunload',{cancelable:true});window.dispatchEvent(warned);expect(warned.defaultPrevented).toBe(true);click('undo');expect(state().dirty).toBe(false);const clean=new Event('beforeunload',{cancelable:true});window.dispatchEvent(clean);expect(clean.defaultPrevented).toBe(false);});
  it('blocks protected edits and restores the original sequence',()=>{ready();click('protect');click('edit');expect(state().sequence).toBe(required(example.dataset.variants[0]).sequence);click('protect');click('edit');click('restore');expect(state().sequence).toBe(required(example.dataset.variants[0]).sequence);});
  it('preserves current edits on an invalid import and ignores its late success',async()=>{ready(inputFile());click('edit');const changed=state().sequence;click('file');await act(async()=>{await Promise.resolve();});const worker=latest();act(()=>{worker.reply({type:'progress',progress:{completed:1,total:3}});});expect(state().progress).toEqual({completed:1,total:3});act(()=>{worker.reply({type:'error',code:'hash'});worker.reply({type:'result',result:example});});expect(state()).toMatchObject({status:'error',error:'hash',sequence:changed,dirty:true});expect(worker.terminate).toHaveBeenCalled();});
  it('cancels a pending read before it can start a worker',async()=>{let resolve:((value:ArrayBuffer)=>void)|undefined;mount(inputFile(()=>new Promise<ArrayBuffer>(value=>{resolve=value;})));click('file');click('cancel');await act(async()=>{required(resolve)(new ArrayBuffer(3));await Promise.resolve();});expect(FakeWorker.instances).toHaveLength(0);expect(state().status).toBe('cancelled');});
  it('terminates a running import and rejects stale responses',()=>{ready();click('example');const worker=latest();click('cancel');act(()=>{worker.reply({type:'result',result:example});});expect(state().status).toBe('cancelled');expect(state().dataset).toBe(C.exampleId);});
  it('rejects an oversized file before starting a worker',()=>{const file=inputFile();Object.defineProperty(file,'size',{value:C.maximumWorkspaceBytes+1});ready(file);click('file');expect(FakeWorker.instances).toHaveLength(1);expect(state().error).toBe('size');});
  it('handles file read failures without losing current results',async()=>{ready(inputFile(()=>Promise.reject(new Error('read failed'))));click('file');await act(async()=>{await Promise.resolve();});expect(state()).toMatchObject({status:'error',error:'schema',dataset:C.exampleId});});
  it('times out and leaves the previous dataset intact',()=>{vi.useFakeTimers();ready();click('example');act(()=>{vi.advanceTimersByTime(C.timeoutMs);});expect(state()).toMatchObject({status:'error',error:'timeout',dataset:C.exampleId});});
  it('handles worker construction and runtime failures',()=>{ready();click('example');act(()=>{latest().onerror?.();});expect(state().error).toBe('worker');vi.stubGlobal('Worker',function unavailable(){throw new Error('blocked');});click('example');expect(state().error).toBe('worker');});
  it('keeps editing disabled while a file is being validated',()=>{ready();const before=state().sequence;click('example');click('edit');expect(state().sequence).toBe(before);});
  it('exports a validated snapshot and retains edits if the download cannot start',()=>{ready();click('edit');click('save');expect(required(latest().requests[0]).type).toBe('export');act(()=>{latest().reply({type:'export',bytes:new Uint8Array([123,125])});});expect(downloadLabFile).toHaveBeenCalledWith(expect.any(Uint8Array),C.workspaceFilename,'application/json');expect(state()).toMatchObject({dirty:false,exported:true,status:'ready'});click('protect');vi.mocked(downloadLabFile).mockImplementationOnce(()=>{throw new Error('unavailable');});click('save');act(()=>{latest().reply({type:'export',bytes:new Uint8Array([123,125])});});expect(state()).toMatchObject({dirty:true,error:'worker'});});
  it('does not export without a dataset',()=>{mount();click('save');expect(FakeWorker.instances).toHaveLength(0);});
});


it('exports for projects without downloading or clearing the unsaved draft',async()=>{
 ready();click('edit');click('cloud document');const bytes=new Uint8Array([123,125]);act(()=>{latest().reply({type:'export',bytes});});
 await expect(cloudDocument).resolves.toEqual(bytes);expect(downloadLabFile).not.toHaveBeenCalled();expect(state()).toMatchObject({dirty:true,exported:false,status:'ready'});
 click('mark original saved');expect(state().dirty).toBe(true);
});
it('changes the import revision only on validated success and settles cancelled cloud operations',async()=>{
 ready();expect(state().revision).toBe(1);click('cloud open');click('cancel');await expect(cloudOpen).resolves.toBeNull();expect(state().revision).toBe(1);
 click('cloud open');act(()=>{latest().reply({type:'error',code:'hash'});});await expect(cloudOpen).resolves.toBeNull();expect(state().revision).toBe(1);
 click('cloud open');act(()=>{latest().reply({type:'result',result:example});});await expect(cloudOpen).resolves.toBe(2);expect(state().revision).toBe(2);
});
