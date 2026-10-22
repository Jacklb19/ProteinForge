import {z} from 'zod';
import {ensure,LAB_CONFIG as C,LabError,required} from './config';
import {sha256} from './zip';
import type {LabReference,LabVariant} from './types';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const sequence=z.string().min(3).max(C.maximumResidues).regex(/^[ACDEFGHIKLMNPQRSTVWY]+$/);
const key=z.object({chain:z.string().regex(/^[A-Za-z0-9]$/),number:z.number().int(),insertion:z.string().regex(/^[A-Za-z]?$/)});
const position=z.object({chainPosition:z.number().int().min(1).max(C.maximumResidues),residue:z.string().regex(/^[ACDEFGHIKLMNPQRSTVWY]$/),referenceKey:key,predictionKey:key});
const draftSchema=z.object({kind:z.literal('proteinforge-design-draft'),schemaVersion:z.literal(2),sequence,
  source:z.object({referenceId:z.string(),referenceChain:z.string(),referenceSequence:sequence,variantSequence:sequence,
    variantSequenceSha256:hash,sample:z.number().int().min(1).max(C.maximumVariants),variantKeys:z.array(key).max(C.maximumResidues)}),
  structureStatus:z.enum(['associated-result','requires-new-prediction']),constraintStatus:z.literal('not-executed'),
  protectedPositions:z.array(position).min(1).max(C.maximumResidues)});
function parse<T>(files:Map<string,Uint8Array>,name:string,schema:z.ZodType<T>):T {
  const bytes=files.get(name);ensure(bytes,'incomplete');let value:unknown;
  try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new LabError('schema');}
  const result=schema.safeParse(value);ensure(result.success,'schema');return result.data;
}
const same=(first:unknown,second:unknown):boolean=>JSON.stringify(first)===JSON.stringify(second);

/** Recheck the draft, measured backbone, actual command inputs and every generated sequence. */
export async function verifyLabConstraints(files:Map<string,Uint8Array>,settings:{draftSha256:string}|undefined,
  reference:LabReference,sequences:string[],samples:number):Promise<LabVariant['constraints']> {
  const names=['design-draft.json','design-input.jsonl','fixed-positions.jsonl','constraints-validation.json'];
  if(!settings){ensure(names.every(name=>!files.has(name)),'schema');ensure(sequences[0]===reference.sequence,'sequence');return undefined;}
  const bytes=files.get('design-draft.json');ensure(bytes&&bytes.length<=C.maximumDraftBytes,'size');
  ensure(await sha256(bytes)===settings.draftSha256,'hash');
  const draft=parse(files,'design-draft.json',draftSchema),source=draft.source;
  ensure(source.referenceId===reference.id&&source.referenceChain===reference.chain&&source.referenceSequence===reference.sequence,'sequence');
  ensure(draft.sequence.length===reference.sequence.length&&source.variantSequence.length===draft.sequence.length
    &&source.variantKeys.length===draft.sequence.length&&new Set(source.variantKeys.map(item=>JSON.stringify(item))).size===source.variantKeys.length,'sequence');
  ensure(await sha256(new TextEncoder().encode(source.variantSequence))===source.variantSequenceSha256,'hash');
  ensure(draft.structureStatus===(draft.sequence===source.variantSequence?'associated-result':'requires-new-prediction'),'schema');
  const positions=draft.protectedPositions.map(item=>item.chainPosition),sorted=[...positions].sort((a,b)=>a-b);
  ensure(new Set(positions).size===positions.length&&positions.length<draft.sequence.length,'sequence');
  for(const entry of draft.protectedPositions){
    const index=entry.chainPosition-1;
    ensure(entry.residue===draft.sequence[index]&&same(entry.referenceKey,reference.keys[index])&&same(entry.predictionKey,source.variantKeys[index]),'sequence');
    ensure(sequences.slice(1).every(value=>value[index]===entry.residue),'sequence');
  }
  ensure(sequences[0]===draft.sequence,'sequence');
  const input=parse(files,'design-input.jsonl',z.record(z.string(),z.unknown())),chain=reference.chain;
  ensure(same(Object.keys(input).sort(),['name','num_of_chains','seq',`seq_chain_${chain}`,`coords_chain_${chain}`].sort())
    &&input.name==='reference'&&input.num_of_chains===1&&input.seq===draft.sequence&&input[`seq_chain_${chain}`]===draft.sequence,'schema');
  const point=z.tuple([z.number(),z.number(),z.number()]);
  const parsedCoordinates=z.record(z.string(),z.array(point).length(draft.sequence.length)).safeParse(input[`coords_chain_${chain}`]);
  ensure(parsedCoordinates.success,'pdb');
  const coordinates=parsedCoordinates.data,atoms=['N','CA','C','O'];
  ensure(same(Object.keys(coordinates).sort(),atoms.map(atom=>`${atom}_chain_${chain}`).sort()),'pdb');
  const pdb=required(files.get('reference.pdb'));
  const lines=new TextDecoder().decode(pdb).split(/\r?\n/).filter(line=>line.startsWith('ATOM  '));
  for(const atom of atoms){
    const measured=lines.filter(line=>line.slice(12,16).trim()===atom).map(line=>[Number(line.slice(30,38)),Number(line.slice(38,46)),Number(line.slice(46,54))]);
    ensure(same(coordinates[`${atom}_chain_${chain}`],measured),'pdb');
  }
  const fixed=parse(files,'fixed-positions.jsonl',z.record(z.string(),z.record(z.string(),z.array(z.number().int()))));
  ensure(same(fixed,{reference:{[chain]:sorted}}),'sequence');
  const report=parse(files,'constraints-validation.json',z.object({status:z.literal('executed'),draftSha256:hash,seedSequence:sequence,
    protectedPositions:z.array(position),samplesCheckedPerRun:z.number().int(),runsChecked:z.literal(2),allProtectedPositionsPreserved:z.literal(true)}));
  ensure(report.draftSha256===settings.draftSha256&&report.seedSequence===draft.sequence
    &&report.samplesCheckedPerRun===samples&&same(report.protectedPositions,draft.protectedPositions),'schema');
  for(const run of ['design','design-repeat']){
    const command=parse(files,`commands/${run}.json`,z.array(z.string()).min(2).max(100));
    ensure(!command.includes('--pdb_path'),'schema');
    for(const [flag,name] of [['--jsonl_path','design-input.jsonl'],['--fixed_positions_jsonl','fixed-positions.jsonl']] as const){
      ensure(command.filter(value=>value===flag).length===1&&command[command.indexOf(flag)+1]?.split('/').at(-1)===name,'schema');
    }
  }
  return {draftSha256:settings.draftSha256,seedSequence:draft.sequence,protectedPositions:sorted.map(value=>value-1)};
}
