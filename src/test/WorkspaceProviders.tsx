import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SequenceDraftProvider } from '../features/editor/SequenceDraftProvider';
import { DEFAULT_EXAMPLE } from '../features/editor/examples';
import { AlignmentDraftProvider } from '../features/alignment/AlignmentDraftProvider';
import { EXAMPLE_ALIGNMENT_DRAFT } from '../features/alignment/examples';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ProjectProvider } from '../features/projects/ProjectProvider';

interface Props {
  children: ReactNode;
  /** Starts both drafts with the bundled examples, as the application shell does; otherwise they start empty. */
  examples?: boolean;
}

/** Providers required by page components when they are rendered outside the application shell. */
export function WorkspaceProviders({ children, examples = false }: Props): React.JSX.Element {
  return <MemoryRouter><AuthProvider settings={null}><SequenceDraftProvider initial={examples ? DEFAULT_EXAMPLE : undefined}><AlignmentDraftProvider initial={examples ? EXAMPLE_ALIGNMENT_DRAFT : undefined}><ProjectProvider api={null}>{children}</ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthProvider></MemoryRouter>;
}

/** The same providers opened on the bundled examples: human insulin, compared with bovine insulin. */
export function ExampleProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return <WorkspaceProviders examples>{children}</WorkspaceProviders>;
}
