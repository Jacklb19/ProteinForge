import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlignmentDraftContext } from './alignmentDraft';
import type { AlignmentDraftState } from './alignmentDraft';
import { DEFAULT_MATRIX, DEFAULT_MODE } from './config';

const INITIAL_DRAFT: AlignmentDraftState = {
  first: '', second: '', matrix: DEFAULT_MATRIX, mode: DEFAULT_MODE, result: null, resultInput: null, warnings: [],
};

/** Keeps alignment inputs and the last result alive across routes; nothing is written to storage. */
export function AlignmentDraftProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState(INITIAL_DRAFT);
  const update = useCallback((changes: Partial<AlignmentDraftState>) => {
    setState((current) => ({ ...current, ...changes }));
  }, []);
  const value = useMemo(() => ({ ...state, update }), [state, update]);
  return <AlignmentDraftContext.Provider value={value}>{children}</AlignmentDraftContext.Provider>;
}
