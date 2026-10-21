import { createContext, useContext } from 'react';
import type { LabErrorCode } from './config';
import type { LabDataset, LabDraft, LabProgress } from './types';

export interface LabState {
  dataset: LabDataset | null; drafts: Record<string,LabDraft>; activeId: string; selected: number;
  status: 'idle'|'loading'|'exporting'|'ready'|'cancelled'|'error'; error: LabErrorCode | null; progress: LabProgress | null;
  dirty: boolean; exported: boolean;
  openExample: () => void; openFile: (file: File) => void; cancel: () => void;
  selectVariant: (id: string) => void; selectResidue: (index: number) => void;
  substitute: (aa: string) => void; protect: () => void; undo: () => void; restore: () => void;
  save: () => void;
}
export const LabContext = createContext<LabState | null>(null);
export function useLab(): LabState { const state=useContext(LabContext); if(!state)throw new Error('Missing laboratory provider'); return state; }
