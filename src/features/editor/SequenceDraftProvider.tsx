import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SequenceDraftContext } from './sequenceDraft';
import { DEFAULT_HYDROPATHY_WINDOW } from '../descriptors/config';
import type { HydropathyWindow } from '../descriptors/config';
import type { SequenceSource } from './source';
import type { ReferenceView } from '../library/referenceView';

interface Props {
  children: ReactNode;
  /** Sequence shown before the visitor brings their own; the application starts with a bundled example. */
  initial?: { text: string; source: SequenceSource | null };
}

/** Keeps the editor text alive across routes; nothing is written to storage. */
export function SequenceDraftProvider({ children, initial }: Props): React.JSX.Element {
  const [text, setTextState] = useState(initial?.text ?? '');
  const [source, setSourceState] = useState<SequenceSource | null>(initial?.source ?? null);
  const [referenceView, setReferenceView] = useState<ReferenceView | null>(null);
  const setText = useCallback((value: string) => { setReferenceView(null); setTextState(value); setSourceState((current) => current?.sequence === value ? current : null); }, []);
  const setSource = useCallback((value: SequenceSource | null) => { setReferenceView(null); setSourceState(value); }, []);
  const [profileWindow, setProfileWindow] = useState<HydropathyWindow>(DEFAULT_HYDROPATHY_WINDOW);
  const value = useMemo(() => ({ text, setText, profileWindow, setProfileWindow, source, setSource, referenceView, setReferenceView }), [text, setText, profileWindow, source, setSource, referenceView]);
  return <SequenceDraftContext.Provider value={value}>{children}</SequenceDraftContext.Provider>;
}
