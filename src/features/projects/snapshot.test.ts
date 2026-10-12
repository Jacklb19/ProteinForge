import { describe, expect, it } from 'vitest';
import { captureWorkspace, workspaceInputKey } from './snapshot';
import type { AlignmentDraftState } from '../alignment/alignmentDraft';
import { calculateDescriptors } from '../descriptors/descriptors';
import { alignSequences } from '../alignment/gotoh';
const EMPTY_ALIGNMENT: AlignmentDraftState = { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null, resultInput: null, warnings: [] };

describe('project result provenance', () => {
  it('omits stale or pending results and normalizes only valid inputs', async () => {
    const result = await alignSequences('ACD', 'ACD');
    const snapshot = captureWorkspace('a c d', { ...EMPTY_ALIGNMENT, first: 'ACD', second: 'ACE', result, resultInput: { first: 'ACD', second: 'ACD', matrix: 'BLOSUM62', mode: 'global' } }, 19, { result: calculateDescriptors('AAA'), status: 'calculating', error: null, excluded: 0 });
    expect(snapshot.activeSequence).toBe('ACD');
    expect(snapshot.workspace.descriptors).toBeNull();
    expect(snapshot.workspace.alignment.result).toBeNull();
    expect(snapshot.workspace.profileWindow).toBe(19);
  });
  it('keeps results with exactly matching scientific inputs and parameters', async () => {
    const input = { first: 'ACD', second: 'ACD', matrix: 'BLOSUM62', mode: 'global' } as const;
    const result = await alignSequences(input.first, input.second);
    const descriptor = calculateDescriptors('ACD');
    const snapshot = captureWorkspace('ACD', { ...EMPTY_ALIGNMENT, ...input, result, resultInput: input }, 9, { result: descriptor, status: 'current', error: null, excluded: 0 });
    expect(snapshot.workspace.alignment.result).toEqual(result);
    expect(snapshot.workspace.descriptors?.sequence).toBe('ACD');
    expect(snapshot.workspace.descriptors?.result).toEqual(descriptor);
  });
  it('blocks invalid positions and over-limit sequences without dropping residues silently', () => {
    expect(() => captureWorkspace('AC!', EMPTY_ALIGNMENT, 9)).toThrow('validation');
    expect(() => captureWorkspace('ACD', { ...EMPTY_ALIGNMENT, second: 'A?' }, 9)).toThrow('validation');
    expect(() => captureWorkspace('A'.repeat(100001), EMPTY_ALIGNMENT, 9)).toThrow('validation');
  });
  it('tracks normalized inputs, profile parameters and invalid alignment edits as unsaved', () => {
    const key = workspaceInputKey('ACD', EMPTY_ALIGNMENT, 9);
    expect(workspaceInputKey('a c d', EMPTY_ALIGNMENT, 9)).toBe(key);
    expect(workspaceInputKey('ACD', EMPTY_ALIGNMENT, 19)).not.toBe(key);
    expect(workspaceInputKey('ACD', { ...EMPTY_ALIGNMENT, second: '?' }, 9)).not.toBe(key);
  });
});
