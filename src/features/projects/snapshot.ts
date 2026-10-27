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
import type { GeneratorHistorySnapshot } from '../generator/history';

/** Lowest version that holds the content, never below the stored one: the server refuses downgrades. */
export function workspaceVersion(content: Pick<WorkspaceSnapshot, 'laboratory' | 'generatorHistory'>, stored?: WorkspaceSnapshot['schemaVersion']): WorkspaceSnapshot['schemaVersion'] {
  const required = content.generatorHistory ? 3 : content.laboratory ? 2 : 1;
  return Math.max(required, stored ?? 1) as WorkspaceSnapshot['schemaVersion'];
}

/** The same workspace with another generator history (null removes it); the other tools' data is untouched. */
export function withGeneratorHistory(workspace: WorkspaceSnapshot, generatorHistory: GeneratorHistorySnapshot | null): WorkspaceSnapshot {
  const rest = { ...workspace };
  delete rest.generatorHistory;
  const next = { ...rest, ...(generatorHistory ? { generatorHistory } : {}) };
  const parsed = workspaceSchema.safeParse({ ...next, schemaVersion: workspaceVersion(next, workspace.schemaVersion) });
  if (!parsed.success) throw new ApiError('validation');
  return parsed.data;
}

/** Only results tied to the current normalized inputs can be sent to storage. */
export function captureWorkspace(text: string, draft: AlignmentDraftState, profileWindow: HydropathyWindow, descriptors?: DescriptorState, saved?: Project | null, source?: SequenceSource | null): { activeSequence: string; workspace: WorkspaceSnapshot } {
  const active = validateSequence(text);
  const first = validateSequence(draft.first);
  const second = validateSequence(draft.second);
  if (active.invalidPositions.length || first.invalidPositions.length || second.invalidPositions.length) throw new ApiError('validation');
  if (active.sequence.length > MAX_PROJECT_SEQUENCE_LENGTH) throw new ApiError('validation');
  const input = { first: first.sequence, second: second.sequence, matrix: draft.matrix, mode: draft.mode };
  const previous = saved?.workspace.descriptors;
  // Other tools' saved data travels unchanged so that saving the analysis never removes it.
  const kept = { laboratory: saved?.workspace.laboratory ?? null, generatorHistory: saved?.workspace.generatorHistory ?? null };
  const snapshot = {
    schemaVersion: workspaceVersion(kept, saved?.workspace.schemaVersion), profileWindow,
    ...(kept.laboratory ? { laboratory: kept.laboratory } : {}),
    ...(kept.generatorHistory ? { generatorHistory: kept.generatorHistory } : {}),
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
