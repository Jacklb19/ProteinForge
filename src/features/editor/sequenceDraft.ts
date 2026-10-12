import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { HydropathyWindow } from '../descriptors/config';

/** The sequence being analyzed, kept in memory while the visitor moves between tools. */
export interface SequenceDraft {
  text: string;
  setText: (text: string) => void;
  profileWindow: HydropathyWindow;
  setProfileWindow: (value: HydropathyWindow) => void;
}

export const SequenceDraftContext = createContext<SequenceDraft | null>(null);

export function useSequenceDraft(): SequenceDraft {
  return useRequiredContext(SequenceDraftContext, 'SequenceDraftProvider');
}
