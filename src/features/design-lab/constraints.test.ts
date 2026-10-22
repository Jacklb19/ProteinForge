import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Blob} from 'node:buffer';
import {DecompressionStream} from 'node:stream/web';
import {caseArchive,caseFiles,constrainedCaseFiles,encode,mutateJson} from '../../test/design-lab-fixtures';
import {importArchive} from './validate';
import {initialDrafts} from './state';
import {required} from './config';
import {exportWorkspace,importLab} from './workspace';
import {sha256} from './zip';

async function redeclareDraft(files:Map<string,Uint8Array>):Promise<void>{
  const digest=await sha256(required(files.get('design-draft.json')));
  const config=JSON.parse(new TextDecoder().decode(required(files.get('config.json')))) as {design:{constraints:{draftSha256:string}}};
  config.design.constraints.draftSha256=digest;files.set('config.json',encode(config));mutateJson(files,'provenance.json',{design:config.design});
  mutateJson(files,'environment.json',{configSha256:await sha256(required(files.get('config.json')))});mutateJson(files,'constraints-validation.json',{draftSha256:digest});
}

beforeEach(()=>{vi.stubGlobal('Blob',Blob);vi.stubGlobal('DecompressionStream',DecompressionStream);});afterEach(()=>{vi.unstubAllGlobals();});
describe('fixed positions from a laboratory draft',()=>{
  it('imports measured backbone constraints, initializes protection and preserves them after reopening',async()=>{
    const archive=(await caseArchive(await constrainedCaseFiles())).buffer,result=await importArchive(archive),variant=required(result.dataset.variants[0]);
    expect(variant.sequence).toBe('ARA');expect(variant.constraints).toMatchObject({seedSequence:'ARA',protectedPositions:[1]});
    const drafts=initialDrafts(result.dataset,null);expect(drafts[variant.id]?.protectedPositions).toEqual([1]);
    const savedDrafts=Object.fromEntries(Object.entries(drafts).map(([id,draft])=>[id,{sequence:draft.sequence,protectedPositions:draft.protectedPositions}]));
    const file=await exportWorkspace(archive,{activeId:variant.id,selected:1,drafts:savedDrafts}),reopened=await importLab(file.buffer,()=>undefined);
    expect(required(reopened.dataset.variants[0]).constraints).toEqual(variant.constraints);expect(reopened.saved?.drafts[variant.id]?.protectedPositions).toEqual([1]);
  });
  it.each([
    ['fixed-positions.jsonl',{reference:{A:[1]}}],['constraints-validation.json',{allProtectedPositionsPreserved:false}],
    ['constraints-validation.json',{samplesCheckedPerRun:2}],['constraints-validation.json',{seedSequence:'AAA'}],
    ['design-input.jsonl',{seq_chain_A:'AAA'}],['design-input.jsonl',{coords_chain_A:{N_chain_A:[[99,0,0],[1,0,0],[0,1,0]],CA_chain_A:[[0,0,0],[1,0,0],[0,1,0]],C_chain_A:[[0,0,0],[1,0,0],[0,1,0]],O_chain_A:[[0,0,0],[1,0,0],[0,1,0]]}}],
  ] as const)('rejects rehashed but inconsistent constraint evidence in %s (%j)',async(name,changes)=>{
    const files=await constrainedCaseFiles();mutateJson(files,name,changes);await expect(importArchive((await caseArchive(files)).buffer)).rejects.toThrow();
  });
  it('rejects a command that never supplied fixed positions',async()=>{
    const files=await constrainedCaseFiles();files.set('commands/design-repeat.json',encode(['python','--jsonl_path','/run/design-input.jsonl']));await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'schema'});
  });
  it('rejects undeclared constraint files in legacy experiments',async()=>{
    const files=await caseFiles();files.set('constraints-validation.json',encode({status:'executed'}));await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'schema'});
  });
  it('rejects a modified draft even when the outer manifest was regenerated',async()=>{
    const files=await constrainedCaseFiles();mutateJson(files,'design-draft.json',{sequence:'AAA'});await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'hash'});
  });
  it.each([
    {schemaVersion:1},{structureStatus:'associated-result'},{protectedPositions:[]},
    {protectedPositions:[{chainPosition:2,residue:'A',referenceKey:{chain:'A',number:2,insertion:''},predictionKey:{chain:'A',number:2,insertion:''}}]},
    {protectedPositions:[{chainPosition:2,residue:'R',referenceKey:{chain:'A',number:99,insertion:''},predictionKey:{chain:'A',number:2,insertion:''}}]},
    {protectedPositions:[{chainPosition:2,residue:'R',referenceKey:{chain:'A',number:2,insertion:''},predictionKey:{chain:'A',number:99,insertion:''}}]},
  ])('rejects a self-rehashed but invalid draft (%j)',async changes=>{
    const files=await constrainedCaseFiles();mutateJson(files,'design-draft.json',changes);await redeclareDraft(files);
    await expect(importArchive((await caseArchive(files)).buffer)).rejects.toThrow();
  });
  it('does not accept a generated sequence that breaks a fixed residue',async()=>{
    const files=await constrainedCaseFiles();files.set('design/seqs/reference.fa',new TextEncoder().encode('>seed\nARA\n>sample\nAAA\n'));files.set('design-repeat/seqs/reference.fa',required(files.get('design/seqs/reference.fa')));
    await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'sequence'});
  });
});
