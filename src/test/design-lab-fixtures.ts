/** Synthetic, nonbiological archive fixtures. Never used as a product example. */
import { crc32, deflateRawSync } from 'node:zlib';
import { LAB_CONFIG as C, required } from '../features/design-lab/config';
import { sha256 } from '../features/design-lab/zip';
import type { Coordinates } from '../features/design-lab/types';

export const encode=(value:unknown):Uint8Array=>new TextEncoder().encode(JSON.stringify(value));
export const points:Coordinates[]=[[0,0,0],[1,0,0],[0,1,0]];
export function testPdb(sequence='AAA', insertion=''):string {
  let serial=0;const lines:string[]=[];
  for(let i=0;i<sequence.length;i++)for(const atom of ['N','CA','C','O']){
    const [x,y,z]=required(points[i]);const aa=sequence[i]==='R'?'ARG':'ALA';
    lines.push(['ATOM  ',String(++serial).padStart(5),' ',atom.padStart(2).padEnd(4),' ',aa,' ','A',String(i+1).padStart(4),i===0?insertion||' ':' ','   ',x.toFixed(3).padStart(8),y.toFixed(3).padStart(8),z.toFixed(3).padStart(8),'  1.00',' 90.00','          ',atom==='N'?' N':atom==='O'?' O':' C','  '].join(''));
  }
  return lines.join('\n')+'\nTER\nEND\n';
}
interface ZipOptions {method?:0|8;zip64Local?:boolean;mode?:number}
export function zipFixture(entries:[string,Uint8Array][],options:ZipOptions={}):Uint8Array<ArrayBuffer> {
  const locals:Uint8Array[]=[],centrals:Uint8Array[]=[];let offset=0;const method=options.method??8;
  for(const [name,data] of entries){
    const filename=new TextEncoder().encode(name),compressed=method===8?new Uint8Array(deflateRawSync(data)):data;
    const extra=options.zip64Local?20:0,header=new Uint8Array(30+filename.length+extra),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(8,method,true);view.setUint32(14,crc32(data),true);view.setUint32(18,options.zip64Local?0xffffffff:compressed.length,true);view.setUint32(22,options.zip64Local?0xffffffff:data.length,true);view.setUint16(26,filename.length,true);view.setUint16(28,extra,true);header.set(filename,30);
    if(options.zip64Local){const start=30+filename.length;view.setUint16(start,1,true);view.setUint16(start+2,16,true);view.setBigUint64(start+4,BigInt(data.length),true);view.setBigUint64(start+12,BigInt(compressed.length),true);}
    const central=new Uint8Array(46+filename.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,0x314,true);cv.setUint16(6,20,true);cv.setUint16(10,method,true);cv.setUint32(16,crc32(data),true);cv.setUint32(20,compressed.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,filename.length,true);cv.setUint32(38,options.mode??0x81a40000,true);cv.setUint32(42,offset,true);central.set(filename,46);
    locals.push(header,compressed);centrals.push(central);offset+=header.length+compressed.length;
  }
  const size=centrals.reduce((sum,value)=>sum+value.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
  const output=new Uint8Array(offset+size+22);let at=0;for(const chunk of [...locals,...centrals,end]){output.set(chunk,at);at+=chunk.length;}return output;
}
export function testPae(negative=false):Uint8Array {
  const header="{'descr': '<f4', 'fortran_order': False, 'shape': (3, 3), }\n",bytes=new Uint8Array(10+header.length+36),view=new DataView(bytes.buffer);
  bytes.set([0x93,78,85,77,80,89,1,0]);view.setUint16(8,header.length,true);bytes.set(new TextEncoder().encode(header),10);
  for(let i=0;i<9;i++)view.setFloat32(10+header.length+i*4,negative?-1:i,true);
  return zipFixture([['pae.npy',bytes]],{zip64Local:true});
}
export async function caseFiles():Promise<Map<string,Uint8Array>> {
  const reference='AAA',seqHash=await sha256(new TextEncoder().encode(reference)),config={schemaVersion:1,reference:{id:'TEST',chain:'A',sequence:reference,sha256:'1'.repeat(64),url:'https://example.org/synthetic.pdb'},design:{revision:C.mpnnRevision,model:'v_48_020',seed:42,samples:1,selectedSample:1,temperature:.1,maxLength:120},prediction:{model:C.foldingModel,revision:C.foldingRevision}};
  const script=new TextEncoder().encode('# Synthetic fixture only\n'),configBytes=encode(config);
  return new Map([
    ['config.json',configBytes],['experiment.py',script],
    ['environment.json',encode({experimentScriptSha256:await sha256(script),configSha256:await sha256(configBytes)})],
    ['provenance.json',encode({experiment:'known-backbone-sequence-redesign',reference:config.reference,design:config.design,prediction:config.prediction})],
    ['validation.json',encode({status:'completed',missing:[],exactCandidateSequence:true,finiteCoordinates:true,completeBackbone:true,repeatedDesign:true})],
    ['candidate.json',encode({sequence:reference,sample:1,selectedBeforePrediction:true,sequenceSha256:seqHash})],
    ['prediction.json',encode({sequence:reference,sequenceSha256:seqHash,model:C.foldingModel,revision:C.foldingRevision,chain:'A',residueCount:3,atomCount:12,plddtRawScale:[0,1],plddtExportScale:[0,100],caPlddt:[90,90,90],meanCaPlddt:90,ptm:.8})],
    ['reference.json',encode({chain:'A',sequence:reference,residueKeys:[[1,''],[2,''],[3,'']],ca:points,atomCount:12})],
    ['reference.pdb',new TextEncoder().encode(testPdb())],['prediction.pdb',new TextEncoder().encode(testPdb())],
    ['candidate.fasta',new TextEncoder().encode('>candidate\nAAA\n')],['reference.fasta',new TextEncoder().encode('>reference\nAAA\n')],
    ['design/seqs/reference.fa',new TextEncoder().encode('>reference\nAAA\n>sample\nAAA\n')],['design-repeat/seqs/reference.fa',new TextEncoder().encode('>reference\nAAA\n>sample\nAAA\n')],
    ['design-summary.json',encode({repeatSequencesEqual:true,candidates:[{sequence:'AAA'}]})],
    ['comparison.json',encode({residuesCompared:3,caRmsdAngstrom:0})],['predicted-aligned-error.npz',testPae()],
  ]);
}
export async function caseArchive(files:Map<string,Uint8Array>):Promise<Uint8Array<ArrayBuffer>> {
  files.delete('result-manifest.json');
  const entries=await Promise.all([...files].map(async([path,bytes])=>({path,bytes:bytes.length,sha256:await sha256(bytes)})));
  files.set('result-manifest.json',encode({schemaVersion:1,status:'completed',files:entries}));return zipFixture([...files]);
}
export function mutateJson(files:Map<string,Uint8Array>,name:string,changes:Record<string,unknown>):void {
  const value=JSON.parse(new TextDecoder().decode(required(files.get(name)))) as Record<string,unknown>;files.set(name,encode({...value,...changes}));
}
