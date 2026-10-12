import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { HydropathyWindow } from '../descriptors/config';
import type { SequenceSource } from './source';

/** The sequence being analyzed, kept in memory while the visitor moves between tools. */
export interface SequenceDraft {
  text: string;
  setText: (text: string) => void;
  profileWindow: HydropathyWindow;
  setProfileWindow: (value: HydropathyWindow) => void;
  source: SequenceSource | null;
  setSource: (source: SequenceSource | null) => void;
}

export const SequenceDraftContext = createContext<SequenceDraft | null>(null);

export function useSequenceDraft(): SequenceDraft {
  return useRequiredContext(SequenceDraftContext, 'SequenceDraftProvider');
}
