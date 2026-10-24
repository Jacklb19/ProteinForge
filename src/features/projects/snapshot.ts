import { validateSequence } from '../editor/sequence';
import type { AlignmentDraftState } from '../alignment/alignmentDraft';
import { isStaleResult } from '../alignment/alignmentSummary';
import type { DescriptorState } from '../descriptors/useDescriptors';
import type { HydropathyWindow } from '../descriptors/config';
import { ApiError } from '../api/errors';
import { DESCRIPTOR_METHOD_VERSION, MAX_PROJECT_SEQUENCE_LENGTH } from './config';
import type { Project, WorkspaceSnapshot } from './contracts';
import { workspaceSchema } from './contracts';
import type { SequenceSource } from '../editor/source';

/** Only results tied to the current normalized inputs can be sent to storage. */
export function captureWorkspace(text: string, draft: AlignmentDraftState, profileWindow: HydropathyWindow, descriptors?: DescriptorState, saved?: Project | null, source?: SequenceSource | null): { activeSequence: string; workspace: WorkspaceSnapshot } {
  const active = validateSequence(text);
  const first = validateSequence(draft.first);
  const second = validateSequence(draft.second);
  if (active.invalidPositions.length || first.invalidPositions.length || second.invalidPositions.length) throw new ApiError('validation');
  if (active.sequence.length > MAX_PROJECT_SEQUENCE_LENGTH) throw new ApiError('validation');
  const input = { first: first.sequence, second: second.sequence, matrix: draft.matrix, mode: draft.mode };
  const previous = saved?.workspace.descriptors;
  const snapshot = {
    schemaVersion: saved?.workspace.laboratory ? 2 : 1, profileWindow,
    ...(saved?.workspace.laboratory ? { laboratory: saved.workspace.laboratory } : {}),
    source: source?.sequence === active.sequence ? source : null,
    descriptors: descriptors?.status === 'current' && descriptors.result ? { sequence: active.sequence, excluded: descriptors.excluded, methodVersion: DESCRIPTOR_METHOD_VERSION, result: descriptors.result } : !descriptors && previous?.sequence === active.sequence ? previous : null,
    alignment: { ...input, result: draft.result && draft.resultInput && !isStaleResult(draft.resultInput, input) ? draft.result : null },
  };
  const parsed = workspaceSchema.safeParse(snapshot);
  if (!parsed.success) throw new ApiError('validation');
  return { activeSequence: active.sequence, workspace: parsed.data };
}

/** Dirty state tracks editable inputs; a background recalculation alone does not change a project. */
export function workspaceInputKey(sequence: string, alignment: Pick<AlignmentDraftState, 'first' | 'second' | 'matrix' | 'mode'>, profileWindow: HydropathyWindow): string {
  return JSON.stringify([validateSequence(sequence).sequence, validateSequence(sequence).invalidPositions, validateSequence(alignment.first).sequence, validateSequence(alignment.first).invalidPositions, validateSequence(alignment.second).sequence, validateSequence(alignment.second).invalidPositions, alignment.matrix, alignment.mode, profileWindow]);
}
