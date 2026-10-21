import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Blob} from 'node:buffer';
import {DecompressionStream} from 'node:stream/web';
import {caseArchive,caseFiles,encode,mutateJson,testPae,testPdb,zipFixture} from '../../test/design-lab-fixtures';
import {importArchive} from './validate';
import {exportWorkspace,importLab,validateSaved} from './workspace';
import {required} from './config';
import type {LabSavedState} from './types';

beforeEach(()=>{vi.stubGlobal('Blob',Blob);vi.stubGlobal('DecompressionStream',DecompressionStream);});afterEach(()=>{vi.unstubAllGlobals();});
describe('result associations',()=>{
  it('validates a complete synthetic package including numeric PAE',async()=>{const bytes=await caseArchive(await caseFiles()),result=await importArchive(bytes.buffer);expect(result.dataset.variants).toHaveLength(1);expect(required(result.dataset.variants[0]).rmsd).toBeLessThan(1e-12);expect(result.archive).toBe(bytes.buffer);});
  it.each([
    ['prediction.json',{sequence:'AAR'},'sequence'],['prediction.json',{meanCaPlddt:30},'confidence'],['prediction.json',{atomCount:2},'confidence'],['prediction.json',{caPlddt:[90,90]},'confidence'],['candidate.json',{sample:2},'sequence'],['comparison.json',{caRmsdAngstrom:2},'comparison'],['design-summary.json',{repeatSequencesEqual:false},'schema'],
  ] as const)('rejects internally rehashed but inconsistent %s (%j)',async(name,changes,code)=>{const files=await caseFiles();mutateJson(files,name,changes);await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code});});
  it('does not accept a valid manifest for a different structure sequence',async()=>{const files=await caseFiles();files.set('prediction.pdb',new TextEncoder().encode(testPdb('AAR')));await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'sequence'});});
  it('rejects negative PAE and missing results',async()=>{const files=await caseFiles();files.set('predicted-aligned-error.npz',testPae(true));await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'confidence'});files.delete('prediction.pdb');await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'incomplete'});});
  it('rejects a digest mismatch before parsing scientific values',async()=>{const files=await caseFiles();await caseArchive(files);files.set('candidate.json',encode({sequence:'RRR'}));await expect(importArchive(zipFixture([...files]).buffer)).rejects.toMatchObject({code:'hash'});});
  it('rejects mismatched script provenance and incomplete manifests',async()=>{const files=await caseFiles();mutateJson(files,'environment.json',{experimentScriptSha256:'0'.repeat(64)});await expect(importArchive((await caseArchive(files)).buffer)).rejects.toMatchObject({code:'hash'});});
});
describe('laboratory file round trip',()=>{
  it('preserves edits and protected positions while revalidating the original archive',async()=>{
    const archive=(await caseArchive(await caseFiles())).buffer,result=await importArchive(archive),variant=required(result.dataset.variants[0]);
    const state:LabSavedState={activeId:variant.id,selected:2,drafts:{[variant.id]:{sequence:'AAR',protectedPositions:[2]}}};
    const output=await exportWorkspace(archive,state),reopened=await importLab(output.buffer,()=>undefined);expect(reopened.saved).toEqual(state);expect(required(reopened.dataset.variants[0]).sequence).toBe('AAA');expect(required(reopened.saved).drafts[variant.id]?.sequence).toBe('AAR');
  });
  it('rejects duplicate protected positions or a wrong draft length',async()=>{
    const result=await importArchive((await caseArchive(await caseFiles())).buffer),variant=required(result.dataset.variants[0]);
    const state:LabSavedState={activeId:variant.id,selected:0,drafts:{[variant.id]:{sequence:'AAA',protectedPositions:[1,1]}}};expect(()=>validateSaved(result.dataset,state)).toThrow();state.drafts[variant.id]={sequence:'AAAA',protectedPositions:[]};expect(()=>validateSaved(result.dataset,state)).toThrow();
  });
  it('rejects unknown example IDs and invalid workspace input',async()=>{await expect(importLab(encode({kind:'proteinforge-laboratory',schemaVersion:1,source:{type:'example',id:'unknown'},state:{}}).buffer as ArrayBuffer,()=>undefined)).rejects.toMatchObject({code:'workspace'});await expect(importLab(new Uint8Array([1,2,3]).buffer,()=>undefined)).rejects.toMatchObject({code:'workspace'});});
});
