import {describe,expect,it} from 'vitest';
import {draftFingerprint,replaceResidue,restoreSequence,toggleProtection,undoDraft} from './state';
import {draftDocument} from './presentation';
import type {LabDraft} from './types';
import {loadExample} from './validate';
import {LAB_CONFIG as C,required} from './config';

const initial=():LabDraft=>({sequence:'AAA',protectedPositions:[],history:[]});
describe('draft editing',()=>{
  it('preserves earlier states and blocks substitution at protected positions',()=>{const original=initial(),locked=toggleProtection(original,1);expect(locked.protectedPositions).toEqual([1]);expect(replaceResidue(locked,1,'R')).toBe(locked);expect(original.protectedPositions).toEqual([]);const unlocked=toggleProtection(locked,1),changed=replaceResidue(unlocked,1,'R');expect(changed.sequence).toBe('ARA');expect(undoDraft(changed)).toEqual(unlocked);});
  it.each([-1,3,NaN])('does not edit an invalid position %s',index=>{const draft=initial();expect(replaceResidue(draft,index,'R')).toBe(draft);expect(toggleProtection(draft,index)).toBe(draft);});
  it('ignores invalid symbols and an unchanged residue',()=>{const draft=initial();expect(replaceResidue(draft,0,'X')).toBe(draft);expect(replaceResidue(draft,0,'A')).toBe(draft);expect(undoDraft(draft)).toBe(draft);});
  it('restores the result sequence without erasing restrictions or history',()=>{const draft=toggleProtection(replaceResidue(initial(),0,'R'),2),restored=restoreSequence(draft,'AAA');expect(restored.sequence).toBe('AAA');expect(restored.protectedPositions).toEqual([2]);expect(undoDraft(restored)).toEqual(draft);});
  it('bounds undo memory and retains the most recent change',()=>{let draft=initial();for(let i=0;i<100;i++)draft=replaceResidue(draft,0,i%2?'A':'R');expect(draft.history).toHaveLength(C.maximumHistory);expect(undoDraft(draft).sequence[0]).toBe('R');});
  it('does not count ordering or undo history as unsaved scientific changes',()=>{const first={a:{sequence:'AAA',protectedPositions:[2,1]}},second={a:{sequence:'AAA',protectedPositions:[1,2]}};expect(draftFingerprint(first)).toBe(draftFingerprint(second));});
  it('exports explicit sequence positions and original structure keys, without claiming constraints ran',async()=>{const {dataset}=await loadExample(),variant=required(dataset.variants[0]),draft=toggleProtection(replaceResidue({...initial(),sequence:variant.sequence},0,'A'),2);expect(draftDocument(dataset.reference,variant,draft)).toMatchObject({sequence:draft.sequence,structureStatus:'requires-new-prediction',constraintStatus:'not-executed',protectedPositions:[{chainPosition:3,residue:'I',referenceKey:{chain:'A',number:3,insertion:''}}]});});
});
