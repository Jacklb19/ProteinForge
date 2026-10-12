import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SequenceDraftContext } from './sequenceDraft';
import { DEFAULT_HYDROPATHY_WINDOW } from '../descriptors/config';
import type { HydropathyWindow } from '../descriptors/config';

/** Keeps the editor text alive across routes; nothing is written to storage. */
export function SequenceDraftProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [text, setText] = useState('');
  const [profileWindow, setProfileWindow] = useState<HydropathyWindow>(DEFAULT_HYDROPATHY_WINDOW);
  const value = useMemo(() => ({ text, setText, profileWindow, setProfileWindow }), [text, profileWindow]);
  return <SequenceDraftContext.Provider value={value}>{children}</SequenceDraftContext.Provider>;
}
