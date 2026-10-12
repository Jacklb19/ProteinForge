import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SequenceDraftProvider } from '../features/editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../features/alignment/AlignmentDraftProvider';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ProjectProvider } from '../features/projects/ProjectProvider';

/** Providers required by page components when they are rendered outside the application shell. */
export function WorkspaceProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return <MemoryRouter><AuthProvider settings={null}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={null}>{children}</ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthProvider></MemoryRouter>;
}
