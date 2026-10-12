import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/apiClient';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { SCORING_SUBSTITUTIONS } from '../alignment/config';
import { useTranslation } from '../../i18n';
import { createProjectApi } from './projectApi';
import type { ProjectApi } from './projectApi';
import type { Project, ProjectSummary } from './contracts';
import { PROJECT_POINTER_PREFIX } from './config';
import { ProjectContext } from './projectContext';
import { captureWorkspace, workspaceInputKey } from './snapshot';
import type { DescriptorState } from '../descriptors/useDescriptors';

interface State { owner: string | null; active: Project | null; items: ProjectSummary[]; nextOffset: number | null; busy: boolean; error: ApiError | null; notice: 'saved' | 'opened' | 'deleted' | null }
const EMPTY: State = { owner: null, active: null, items: [], nextOffset: null, busy: false, error: null, notice: null };

function remember(owner: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(`${PROJECT_POINTER_PREFIX}${owner}`, id);
    else localStorage.removeItem(`${PROJECT_POINTER_PREFIX}${owner}`);
  } catch { /* Private contexts may disable storage; server persistence still works. */ }
}
function lastProject(owner: string): string | null {
  try { const id = localStorage.getItem(`${PROJECT_POINTER_PREFIX}${owner}`); return id && /^[a-f0-9-]{36}$/i.test(id) ? id : null; } catch { return null; }
}

/** Holds no private sequence in browser storage. On reload, retrieves the last project with the user's JWT. */
export function ProjectProvider({ children, api }: { children: ReactNode; api?: ProjectApi | null }): React.JSX.Element {
  const auth = useAuth();
  const sequence = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const { setText, setProfileWindow, setSource } = sequence;
  const { update } = alignment;
  const { t } = useTranslation();
  const [configuredApi] = useState(() => { const url = readApiBaseUrl(); return url ? createProjectApi(url) : null; });
  const client = api === undefined ? configuredApi : api;
  const user = auth.status === 'signed-in' ? auth.session?.user.id ?? null : null;
  const token = auth.session?.accessToken ?? '';
  const [state, setState] = useState<State>(EMPTY);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const current = state.owner === user ? state : EMPTY;

  const restore = useCallback((project: Project) => {
    setText(project.activeSequence);
    setProfileWindow(project.workspace.profileWindow);
    setSource(project.workspace.source ?? null);
    const restored = project.workspace.alignment;
    const warnings = SCORING_SUBSTITUTIONS.filter(({ residue }) => restored.first.includes(residue) || restored.second.includes(residue)).map(({ warningKey }) => t(warningKey));
    update({ ...restored, resultInput: restored.result ? { first: restored.first, second: restored.second, matrix: restored.matrix, mode: restored.mode } : null, warnings });
  }, [setText, setProfileWindow, setSource, update, t]);

  // Initial restore runs once per owner. Token refresh does not replace an edited workspace.
  useEffect(() => {
    const epoch = ++generation.current;
    const cleanupGeneration = generation;
    const operation = new AbortController();
    controller.current?.abort();
    controller.current = operation;
    locked.current = Boolean(user && client);
    const id = user ? lastProject(user) : null;
    const canRestore = !sequence.text && !alignment.first && !alignment.second;
    queueMicrotask(() => { setState({ ...EMPTY, owner: user, busy: Boolean(user && client) }); });
    if (user && client) {
      void (async () => {
        try {
          const listing = await client.list(token, 0, operation.signal);
          const project = id && canRestore ? await client.open(id, token, operation.signal) : null;
          if (epoch !== generation.current) return;
          if (project) restore(project);
          setState({ ...EMPTY, owner: user, active: project, items: listing.items, nextOffset: listing.nextOffset, notice: project ? 'opened' : null });
        } catch (error) {
          if (epoch !== generation.current) return;
          const failure = error instanceof ApiError ? error : new ApiError('unknown');
          if (failure.code === 'not-found' && user) remember(user, null);
          setState({ ...EMPTY, owner: user, error: failure });
        } finally { if (epoch === generation.current) locked.current = false; }
      })();
    }
    return () => { ++cleanupGeneration.current; operation.abort(); locked.current = false; };
    // Read current inputs only when the owner changes; they must not trigger another restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, client]);

  useEffect(() => {
    if (!current.active || !user) return;
    const active = current.active;
    const warn = (event: BeforeUnloadEvent) => {
      if (workspaceInputKey(sequence.text, alignment, sequence.profileWindow) === workspaceInputKey(active.activeSequence, active.workspace.alignment, active.workspace.profileWindow)) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); };
  }, [current.active, user, sequence.text, sequence.profileWindow, alignment]);

  async function run(task: (client: ProjectApi, signal: AbortSignal) => Promise<void>): Promise<boolean> {
    if (!client || !user || !token || locked.current) return false;
    locked.current = true;
    const epoch = ++generation.current;
    const operation = new AbortController();
    controller.current?.abort(); controller.current = operation;
    setState((value) => ({ ...value, owner: user, busy: true, error: null, notice: null }));
    try {
      await task(client, operation.signal);
      return !operation.signal.aborted && generation.current === epoch;
    } catch (error) {
      if (!operation.signal.aborted && generation.current === epoch) setState((value) => ({ ...value, error: error instanceof ApiError ? error : new ApiError('unknown') }));
      return false;
    } finally {
      if (generation.current === epoch) { locked.current = false; setState((value) => ({ ...value, busy: false })); }
    }
  }

  const dirty = Boolean(current.active && workspaceInputKey(sequence.text, alignment, sequence.profileWindow) !== workspaceInputKey(current.active.activeSequence, current.active.workspace.alignment, current.active.workspace.profileWindow));
  const value = {
    enabled: client !== null, active: current.active, items: current.items, nextOffset: current.nextOffset,
    busy: current.busy, error: current.error, notice: current.notice, dirty,
    refresh(more = false) { return run(async (service, signal) => {
      const listing = await service.list(token, more ? current.nextOffset ?? 0 : 0, signal);
      if (signal.aborted) return;
      setState((value) => ({ ...value, items: more ? [...value.items, ...listing.items.filter((item) => !value.items.some((existing) => item.id === existing.id))] : listing.items, nextOffset: listing.nextOffset }));
    }); },
    open(id: string) { return run(async (service, signal) => {
      const project = await service.open(id, token, signal);
      if (signal.aborted) return;
      restore(project); if (user) remember(user, project.id);
      setState((value) => ({ ...value, active: project, notice: 'opened' }));
    }); },
    save(name: string, descriptors?: DescriptorState, copy = false) { return run(async (service, signal) => {
      const snapshot = captureWorkspace(sequence.text, alignment, sequence.profileWindow, descriptors, current.active, sequence.source);
      const project = await service.save({ ...snapshot, name: name.trim() }, token, copy ? undefined : current.active ?? undefined, signal);
      if (signal.aborted) return;
      if (user) remember(user, project.id);
      setState((value) => ({ ...value, active: project, notice: 'saved', items: [project, ...value.items.filter((item) => item.id !== project.id)] }));
    }); },
    rename(project: ProjectSummary, name: string) { return run(async (service, signal) => {
      const stored = await service.open(project.id, token, signal);
      if (stored.updatedAt !== project.updatedAt) throw new ApiError('conflict');
      if (current.active?.id === project.id && current.active.updatedAt !== stored.updatedAt) throw new ApiError('conflict');
      const updated = await service.save({ name: name.trim(), activeSequence: stored.activeSequence, workspace: stored.workspace }, token, project, signal);
      if (signal.aborted) return;
      setState((value) => ({ ...value, active: value.active?.id === project.id ? { ...value.active, name: updated.name, updatedAt: updated.updatedAt } : value.active, items: value.items.map((item) => item.id === project.id ? updated : item), notice: 'saved' }));
    }); },
    remove(project: ProjectSummary) { return run(async (service, signal) => {
      await service.remove(project.id, project.updatedAt, token, signal);
      if (signal.aborted) return;
      if (current.active?.id === project.id && user) remember(user, null);
      setState((value) => ({ ...value, active: value.active?.id === project.id ? null : value.active, items: value.items.filter((item) => item.id !== project.id), notice: 'deleted' }));
    }); },
    detach() { if (locked.current) return; if (user) remember(user, null); setState((value) => ({ ...value, active: null, error: null, notice: null })); },
  };
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

