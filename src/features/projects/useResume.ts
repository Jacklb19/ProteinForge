import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { ApiError } from '../api/errors';
import type { SequenceDraft } from '../editor/sequenceDraft';
import type { AlignmentDraft } from '../alignment/alignmentDraft';
import { SCORING_SUBSTITUTIONS } from '../alignment/config';
import type { ProjectApi } from './projectApi';
import type { Project } from './contracts';
import { EMPTY, lastProject, remember, untouchedDrafts } from './projectState';
import type { ProjectCore } from './projectState';

/**
 * Puts a stored project into the Analyze and Compare drafts, and on sign-in lists the account's projects
 * and resumes the last one over untouched drafts. Returns the function that fills the drafts.
 */
export function useResume(core: ProjectCore, sequence: SequenceDraft, alignment: AlignmentDraft, inputRevision: RefObject<number>, watched: (service: ProjectApi) => ProjectApi, poke: () => void): (project: Project) => void {
  const { user, token, client, gate, setState } = core;
  const { setText, setProfileWindow, setSource } = sequence;
  const { update } = alignment;
  const restore = useCallback((project: Project) => {
    setText(project.activeSequence);
    setProfileWindow(project.workspace.profileWindow);
    setSource(project.workspace.source ?? null);
    const restored = project.workspace.alignment;
    const warnings = SCORING_SUBSTITUTIONS.filter(({ residue }) => restored.first.includes(residue) || restored.second.includes(residue)).map(({ warningKey }) => warningKey);
    update({ ...restored, resultInput: restored.result ? { first: restored.first, second: restored.second, matrix: restored.matrix, mode: restored.mode } : null, warnings });
  }, [setText, setProfileWindow, setSource, update]);

  // Initial restore runs once per owner. Token refresh does not replace an edited workspace.
  useEffect(() => {
    const epoch = gate.advance();
    const operation = new AbortController();
    gate.replace(operation);
    gate.lock(Boolean(user && client));
    const id = user ? lastProject(user) : null;
    // The last project resumes only over untouched drafts.
    const canRestore = untouchedDrafts(sequence, alignment);
    const resumeRevision = inputRevision.current;
    queueMicrotask(() => { setState({ ...EMPTY, owner: user, busy: Boolean(user && client) }); });
    if (user && client) {
      const service = watched(client);
      void (async () => {
        try {
          const listing = await service.list(token, '', operation.signal);
          const project = id && canRestore && resumeRevision === inputRevision.current && !operation.signal.aborted
            ? await service.open(id, token, operation.signal) : null;
          if (epoch !== gate.epoch) return;
          const resumed = resumeRevision === inputRevision.current ? project : null;
          if (resumed) restore(resumed);
          setState({ ...EMPTY, owner: user, active: resumed, items: listing.items, nextPageToken: listing.nextPageToken, notice: resumed ? 'opened' : null });
        } catch (error) {
          if (epoch !== gate.epoch) return;
          const failure = error instanceof ApiError ? error : new ApiError('unknown');
          if (failure.code === 'not-found' && user) remember(user, null);
          setState({ ...EMPTY, owner: user, error: failure });
        } finally { if (epoch === gate.epoch) { gate.lock(false); poke(); } }
      })();
    }
    return () => { gate.advance(); operation.abort(); gate.lock(false); };
    // Read current inputs only when the owner changes; they must not trigger another restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, client]);
  return restore;
}
