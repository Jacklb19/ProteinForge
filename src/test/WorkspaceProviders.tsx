import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SequenceDraftProvider } from '../features/editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../features/alignment/AlignmentDraftProvider';

/** Providers required by page components when they are rendered outside the application shell. */
export function WorkspaceProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return <MemoryRouter><SequenceDraftProvider><AlignmentDraftProvider>{children}</AlignmentDraftProvider></SequenceDraftProvider></MemoryRouter>;
}
