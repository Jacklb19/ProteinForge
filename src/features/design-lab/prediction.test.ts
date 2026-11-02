import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob } from 'node:buffer';
import { DecompressionStream } from 'node:stream/web';
import { caseArchive, caseFiles } from '../../test/design-lab-fixtures';
import { predictionFixture } from '../../test/predictionFixture';
import { compareWithReference, validatePrediction } from './prediction';
import { exportWorkspace, importLab } from './workspace';
import { sha256 } from './zip';
import { LAB_CONFIG, required } from './config';
import { importArchive } from './validate';
import { workspaceSchema } from '../projects/contracts';
import { workspaceVersion } from '../projects/snapshot';
import { PREDICTION_CONFIG, predictionEnabled } from './predictionConfig';
import ubiquitin from './fixtures/ubiquitin.json';
import atlas from './fixtures/esm-atlas-sample-1-ca.json';
import type { Coordinates } from './types';

beforeEach(()=>{vi.stubGlobal('Blob',Blob);vi.stubGlobal('DecompressionStream',DecompressionStream);});
afterEach(()=>{vi.unstubAllGlobals();});

it('keeps original PDB bytes and validates exact sequence without assigning confidence',async()=>{
  expect(predictionEnabled({...import.meta.env,VITE_STRUCTURE_PREDICTION:''})).toBe(false);
  expect(predictionEnabled({...import.meta.env,VITE_STRUCTURE_PREDICTION:'enabled'})).toBe(true);
  const prediction=await predictionFixture(),result=await validatePrediction(prediction,'AAA');
  expect(result.keys).toHaveLength(3);expect(result.ca).toHaveLength(3);expect(result.prediction.pdb).toBe(prediction.pdb);
  expect(result.prediction).toMatchObject({confidence:null,ptm:null,pae:null,modelRevision:null});
  await expect(validatePrediction(prediction,'AAR')).rejects.toMatchObject({code:'sequence'});
});
it('rejects rehashed malformed, incomplete and multiple-model PDBs and manufactured metrics',async()=>{
  const prediction=await predictionFixture();
  for(const pdb of [prediction.pdb+'MODEL        2\n',prediction.pdb.split('\n').filter(line=>line.slice(12,16).trim()!=='CA').join('\n'),prediction.pdb.replace('   0.000','     nan'),'<html>bad</html>']){
    expect(pdb).not.toBe(prediction.pdb);
    await expect(validatePrediction({...prediction,pdb,pdbSha256:await sha256(new TextEncoder().encode(pdb))},'AAA')).rejects.toThrow();
  }
  await expect(validatePrediction({...prediction,pdbSha256:'0'.repeat(64)},'AAA')).rejects.toMatchObject({code:'hash'});
  await expect(validatePrediction({...prediction,ptm:.9},'AAA')).rejects.toMatchObject({code:'schema'});
});
it('rejects a noncanonical ATOM record instead of silently skipping its invalid geometry',async()=>{
  const prediction=await predictionFixture(),original=required(prediction.pdb.split('\n')[0]);
  let hidden='ATOM\t '+original.slice(6);
  hidden=hidden.slice(0,21)+'B'+hidden.slice(22,30)+'     nan'+hidden.slice(38);
  const pdb=prediction.pdb.replace('\nEND',`\n${hidden}\nEND`);
  expect(pdb).not.toBe(prediction.pdb);
  await expect(validatePrediction({...prediction,pdb,pdbSha256:await sha256(new TextEncoder().encode(pdb))},'AAA')).rejects.toMatchObject({code:'pdb'});
});
it('round trips predictions separately from old experiment results and keeps v2 when emptied',async()=>{
  const archive=(await caseArchive(await caseFiles())).buffer,dataset=(await importArchive(archive)).dataset,id=required(dataset.variants[0]).id;
  const saved={activeId:id,selected:0,drafts:{[id]:{sequence:'AAR',protectedPositions:[1]}}};
  const predictions={[id]:await predictionFixture('AAR')};
  const exported=await exportWorkspace(archive,saved,predictions),reopened=await importLab(exported.buffer,()=>undefined);
  expect(reopened.saved).toEqual(saved);expect(reopened.predictions).toEqual(predictions);expect(required(reopened.dataset.variants[0]).sequence).toBe('AAA');
  const empty=await exportWorkspace(archive,saved,{});expect((await importLab(empty.buffer,()=>undefined)).predictions).toEqual({});
  const old=await exportWorkspace(archive,saved);expect((await importLab(old.buffer,()=>undefined)).predictions).toBeUndefined();
  await expect(exportWorkspace(archive,saved,{[id]:await predictionFixture('AAA')})).rejects.toMatchObject({code:'sequence'});
  const laboratory={schemaVersion:1 as const,documentJson:new TextDecoder().decode(exported),documentSha256:await sha256(exported)};
  const workspace={schemaVersion:4 as const,profileWindow:9,source:null,descriptors:null,alignment:{first:'',second:'',matrix:'BLOSUM62',mode:'global',result:null},laboratory};
  expect(workspaceVersion({laboratory})).toBe(4);expect(workspaceVersion({laboratory},4)).toBe(4);expect(workspaceSchema.safeParse(workspace).success).toBe(true);
  for(const schemaVersion of [1,2,3])expect(workspaceSchema.safeParse({...workspace,schemaVersion}).success).toBe(false);
  expect(workspaceSchema.safeParse({...workspace,laboratory:null}).success).toBe(false);
});
describe('compareWithReference',()=>{
  const line=(count:number):Coordinates[]=>Array.from({length:count},(_,index)=>[index*3.8,Math.sin(index),Math.cos(index)*2]);
  it('pairs every position by index and measures the recorded ESM Atlas prediction like the Colab figure',()=>{
    const result=compareWithReference(ubiquitin.reference.ca as Coordinates[],atlas.ca as Coordinates[]);
    expect(result.status).toBe('measured');
    if(result.status!=='measured')return;
    // Figure computed for the approved mock-up with the same superpose() (artifacts/prediction-rmsd-2026-11-02/rmsd-real.json).
    expect(Math.abs(result.rmsd-0.8230808970086123)).toBeLessThan(LAB_CONFIG.rmsdTolerance);
    expect(result.paired).toBe(76);expect(result.alignedCa).toHaveLength(76);
    const colab=required(ubiquitin.samples[0]),again=compareWithReference(ubiquitin.reference.ca as Coordinates[],colab.ca as Coordinates[]);
    expect(again.status==='measured'&&Math.abs(again.rmsd-colab.rmsd)).toBeLessThan(LAB_CONFIG.rmsdTolerance);
  });
  it('is zero for a rigidly moved copy and needs the minimum number of positions',()=>{
    const reference=line(PREDICTION_CONFIG.minimumPairedPositions),moved=reference.map(([x,y,z])=>[-y+5,x-2,z+1] as Coordinates);
    const result=compareWithReference(reference,moved);
    expect(result.status==='measured'&&result.rmsd).toBeLessThan(LAB_CONFIG.rmsdTolerance);
    const short=line(PREDICTION_CONFIG.minimumPairedPositions-1);
    expect(compareWithReference(short,short)).toEqual({status:'too-few',paired:short.length});
  });
  it('never invents a figure without a reference or for a different length',()=>{
    expect(compareWithReference(null,line(5))).toEqual({status:'no-reference'});
    expect(compareWithReference(line(6),line(5))).toEqual({status:'too-few',paired:0});
  });
});
