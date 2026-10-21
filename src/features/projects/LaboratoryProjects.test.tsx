import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {AuthContext} from '../auth/authContext';
import {signedInFixture} from '../../test/authFixture';
import {SequenceDraftProvider} from '../editor/SequenceDraftProvider';
import {AlignmentDraftProvider} from '../alignment/AlignmentDraftProvider';
import {useSequenceDraft} from '../editor/sequenceDraft';
import {LabContext} from '../design-lab/context';
import type {LabState} from '../design-lab/context';
import {loadExample} from '../design-lab/validate';
import {exportWorkspace} from '../design-lab/workspace';
import {initialDrafts,draftFingerprint} from '../design-lab/state';
import {required} from '../design-lab/config';
import {ProjectProvider} from './ProjectProvider';
import {useProjects} from './projectContext';
import type {Project,ProjectWrite} from './contracts';
import type {ProjectApi} from './projectApi';
import {ApiError} from '../api/apiClient';
import {sha256} from '../design-lab/zip';

let lab:LabState,bytes:Uint8Array<ArrayBuffer>,stored:Project;
const analysis:Project={id:'00000000-0000-4000-8000-000000000010',name:'Analysis',activeSequence:'ACD',status:'draft',createdAt:'2026-10-12T08:00:00.123456Z',updatedAt:'2026-10-12T08:00:00.123456Z',workspace:{schemaVersion:1,profileWindow:9,descriptors:null,alignment:{first:'',second:'',matrix:'BLOSUM62',mode:'global',result:null}}};
beforeAll(async()=>{
 const {dataset}=await loadExample(),drafts=initialDrafts(dataset,null),activeId=required(dataset.variants[0]).id;
 bytes=await exportWorkspace(null,{activeId,selected:0,drafts:Object.fromEntries(Object.entries(drafts).map(([id,d])=>[id,{sequence:d.sequence,protectedPositions:d.protectedPositions}]))});
 lab={dataset,drafts,activeId,selected:0,status:'ready',error:null,progress:null,dirty:true,exported:false,revision:0,document:vi.fn().mockResolvedValue(bytes),openDocument:vi.fn().mockResolvedValue(0),markSaved:vi.fn(),openExample:vi.fn(),openFile:vi.fn(),cancel:vi.fn(),selectVariant:vi.fn(),selectResidue:vi.fn(),substitute:vi.fn(),protect:vi.fn(),undo:vi.fn(),restore:vi.fn(),save:vi.fn()};
});
beforeEach(async()=>{localStorage.clear();vi.clearAllMocks();vi.mocked(lab.document).mockResolvedValue(bytes);vi.mocked(lab.openDocument).mockResolvedValue(0);stored={...analysis,id:'00000000-0000-4000-8000-000000000011',name:'Laboratory',workspace:{...analysis.workspace,schemaVersion:2,laboratory:{schemaVersion:1,documentJson:new TextDecoder().decode(bytes),documentSha256:await sha256(bytes)}}};});
function api():ProjectApi{return{list:vi.fn().mockResolvedValue({items:[],nextPageToken:null}),open:vi.fn().mockImplementation((id:string)=>Promise.resolve(id===analysis.id?analysis:stored)),save:vi.fn().mockImplementation((write:ProjectWrite)=>Promise.resolve({...stored,...write,updatedAt:'2026-10-12T08:00:01.123456Z'})),remove:vi.fn().mockResolvedValue(undefined)};}
function Harness(){const p=useProjects(),s=useSequenceDraft();return <><output data-testid="state">{JSON.stringify({active:p.active?.id,lab:p.laboratory?.id,version:p.laboratory?.updatedAt,error:p.error?.code,sequence:s.text,busy:p.busy})}</output><button onClick={()=>{void p.open(analysis.id);}}>analysis</button><button onClick={()=>{void p.open(stored.id,'laboratory');}}>open</button><button onClick={()=>{void p.saveLaboratory('Saved');}}>save</button><button onClick={()=>{void p.saveLaboratory('Copy',true);}}>copy</button><button onClick={()=>{void p.rename(stored,'Renamed');}}>rename</button><button onClick={()=>{void p.remove(stored);}}>delete</button></>;}
function mount(service:ProjectApi,value=lab){return render(<AuthContext.Provider value={signedInFixture}><SequenceDraftProvider><AlignmentDraftProvider><LabContext.Provider value={value}><ProjectProvider api={service}><Harness/></ProjectProvider></LabContext.Provider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>);}
const state=()=>JSON.parse(screen.getByTestId('state').textContent) as {active?:string;lab?:string;error?:string;sequence:string;busy:boolean;version?:string};
async function ready(){await waitFor(()=>{expect(state().busy).toBe(false);});}
async function click(name:string){fireEvent.click(screen.getByRole('button',{name}));await ready();}
it('creates independently of analysis binding and preserves its inputs when opening laboratory',async()=>{
 const service=api();mount(service);await ready();await click('analysis');await click('save');
 expect(vi.mocked(service.save).mock.calls[0]?.[0].workspace.schemaVersion).toBe(2);
 expect(vi.mocked(service.save).mock.calls[0]?.[2]).toBeUndefined();
 expect(state()).toMatchObject({active:analysis.id,lab:stored.id,sequence:'ACD'});
 expect(lab.markSaved).toHaveBeenCalledWith(draftFingerprint(lab.drafts));
 await click('open');expect(lab.openDocument).toHaveBeenCalledWith(expect.objectContaining({byteLength:bytes.byteLength}),stored.workspace.laboratory?.documentSha256);
 expect(state()).toMatchObject({active:analysis.id,lab:stored.id,sequence:'ACD'});
 await click('save');expect(service.save).toHaveBeenLastCalledWith(expect.anything(),'owner-token',expect.objectContaining({id:stored.id}),expect.any(AbortSignal));
});
it('keeps binding and draft on conflict and offers a version-independent copy',async()=>{
 const service=api();mount(service);await ready();await click('open');vi.mocked(service.save).mockRejectedValueOnce(new ApiError('conflict'));await click('save');
 expect(state()).toMatchObject({lab:stored.id,error:'conflict'});expect(lab.markSaved).not.toHaveBeenCalled();
 await click('copy');expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({workspace:stored.workspace}),'owner-token',undefined,expect.any(AbortSignal));
});
it('retains binding when reopening fails without restoring analysis',async()=>{
 const service=api();mount(service);await ready();await click('open');vi.mocked(lab.openDocument).mockResolvedValueOnce(null);await click('open');
 expect(state()).toMatchObject({lab:stored.id,error:'validation',sequence:''});
});
it('updates the laboratory version when renaming and detaches after deletion',async()=>{
 const service=api();mount(service);await ready();await click('open');await click('rename');expect(state().version).toBe('2026-10-12T08:00:01.123456Z');
 expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({workspace:stored.workspace}),'owner-token',expect.objectContaining({id:stored.id}),expect.any(AbortSignal));
 await click('delete');expect(state().lab).toBeUndefined();
});
it('rejects oversized UTF8 documents before storage and never marks a discarded envelope saved',async()=>{
 const service=api();mount(service);await ready();vi.mocked(lab.document).mockResolvedValueOnce(new Uint8Array(1_000_001));await click('save');expect(state().error).toBe('laboratory-size');expect(service.save).not.toHaveBeenCalled();
 vi.mocked(service.save).mockResolvedValueOnce(analysis);await click('save');expect(state().error).toBe('invalid-response');expect(lab.markSaved).not.toHaveBeenCalled();expect(state().lab).toBeUndefined();
});
