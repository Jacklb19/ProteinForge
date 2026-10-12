import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';

/** The sequence being analyzed, kept in memory while the visitor moves between tools. */
export interface SequenceDraft {
  text: string;
  setText: (text: string) => void;
}

export const SequenceDraftContext = createContext<SequenceDraft | null>(null);

export function useSequenceDraft(): SequenceDraft {
  return useRequiredContext(SequenceDraftContext, 'SequenceDraftProvider');
}
