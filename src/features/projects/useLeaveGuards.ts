import { useEffect } from 'react';
import type { SequenceDraft } from '../editor/sequenceDraft';
import type { AlignmentDraft } from '../alignment/alignmentDraft';
import type { Project } from './contracts';
import { workspaceInputKey } from './snapshot';
import { untouchedDrafts } from './projectState';

/** Asks before leaving the page (the browser's own prompt) while the drafts hold work that is not stored. */
export function useLeaveGuards(active: Project | null, user: string | null, sequence: SequenceDraft, alignment: AlignmentDraft): void {
  useEffect(() => {
    if (!active || !user) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (workspaceInputKey(sequence.text, alignment, sequence.profileWindow) === workspaceInputKey(active.activeSequence, active.workspace.alignment, active.workspace.profileWindow)) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); };
  }, [active, user, sequence.text, sequence.profileWindow, alignment]);

  // Without an open project the drafts exist only in this tab, so leaving with the visitor's own input asks first.
  const ownInput = !untouchedDrafts(sequence, alignment);
  useEffect(() => {
    if (active || !ownInput) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); };
  }, [active, ownInput]);
}
