import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob } from 'node:buffer';
import { DecompressionStream } from 'node:stream/web';
import { caseArchive, caseFiles } from '../../test/design-lab-fixtures';
import { predictionFixture } from '../../test/predictionFixture';
import { validatePrediction } from './prediction';
import { exportWorkspace, importLab } from './workspace';
import { sha256 } from './zip';
import { required } from './config';
import { importArchive } from './validate';
import { workspaceSchema } from '../projects/contracts';
import { workspaceVersion } from '../projects/snapshot';
import { predictionEnabled } from './predictionConfig';

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
