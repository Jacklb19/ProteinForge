import { LAB_CONFIG as C } from './config';
import type { LabDataset, LabDraft, LabDraftSnapshot, LabSavedState } from './types';

export function initialDrafts(dataset: LabDataset, saved: LabSavedState | null): Record<string,LabDraft> {
  return Object.fromEntries(dataset.variants.map(variant => [variant.id,{ ...(saved?.drafts[variant.id] ?? {sequence:variant.sequence,protectedPositions:[]}),history:[] }]));
}
export function draftFingerprint(drafts:Record<string,LabDraftSnapshot>):string {
  return JSON.stringify(Object.keys(drafts).sort().map(id=>[id,drafts[id]?.sequence,[...(drafts[id]?.protectedPositions??[])].sort((a,b)=>a-b)]));
}
function commit(draft: LabDraft, next: LabDraftSnapshot): LabDraft {
  if (draft.sequence === next.sequence && draft.protectedPositions.join() === next.protectedPositions.join()) return draft;
  return {...next,history:[...draft.history,{sequence:draft.sequence,protectedPositions:draft.protectedPositions}].slice(-C.maximumHistory)};
}
export function replaceResidue(draft: LabDraft, index: number, aa: string): LabDraft {
  if (draft.protectedPositions.includes(index) || !Number.isInteger(index) || index < 0 || index >= draft.sequence.length || !/^[ACDEFGHIKLMNPQRSTVWY]$/.test(aa)) return draft;
  return commit(draft,{sequence:draft.sequence.slice(0,index)+aa+draft.sequence.slice(index+1),protectedPositions:draft.protectedPositions});
}
export function toggleProtection(draft: LabDraft, index: number): LabDraft {
  if (!Number.isInteger(index) || index < 0 || index >= draft.sequence.length) return draft;
  const protectedPositions = draft.protectedPositions.includes(index) ? draft.protectedPositions.filter(value => value !== index) : [...draft.protectedPositions,index].sort((a,b) => a-b);
  return commit(draft,{sequence:draft.sequence,protectedPositions});
}
export function restoreSequence(draft: LabDraft, sequence: string): LabDraft { return commit(draft,{sequence,protectedPositions:draft.protectedPositions}); }
export function undoDraft(draft: LabDraft): LabDraft {
  const previous = draft.history.at(-1); return previous ? {...previous,history:draft.history.slice(0,-1)} : draft;
}
