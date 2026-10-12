import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SequenceDraftContext } from './sequenceDraft';

/** Keeps the editor text alive across routes; nothing is written to storage. */
export function SequenceDraftProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [text, setText] = useState('');
  const value = useMemo(() => ({ text, setText }), [text]);
  return <SequenceDraftContext.Provider value={value}>{children}</SequenceDraftContext.Provider>;
}
