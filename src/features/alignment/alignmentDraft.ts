import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { AlignmentMode, MatrixName } from './config';
import type { AlignmentResult } from './gotoh';

/** Validated inputs that produced a result, used to detect stale results. */
export interface AlignmentInput {
  first: string;
  second: string;
  matrix: MatrixName;
  mode: AlignmentMode;
}

export interface AlignmentDraftState {
  first: string;
  second: string;
  matrix: MatrixName;
  mode: AlignmentMode;
  result: AlignmentResult | null;
  resultInput: AlignmentInput | null;
  warnings: string[];
}

/** Alignment inputs and last result, kept in memory while the visitor moves between tools. */
export interface AlignmentDraft extends AlignmentDraftState {
  update: (changes: Partial<AlignmentDraftState>) => void;
}

export const AlignmentDraftContext = createContext<AlignmentDraft | null>(null);

export function useAlignmentDraft(): AlignmentDraft {
  return useRequiredContext(AlignmentDraftContext, 'AlignmentDraftProvider');
}
