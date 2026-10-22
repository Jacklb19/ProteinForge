import { DEFAULT_EXAMPLE } from '../editor/examples';
import { EXAMPLE_ALIGNMENT_INPUT } from '../alignment/examples';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/apiClient';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { DEFAULT_MATRIX, DEFAULT_MODE, SCORING_SUBSTITUTIONS } from '../alignment/config';
import { DEFAULT_HYDROPATHY_WINDOW } from '../descriptors/config';
import { createProjectApi } from './projectApi';
import type { ProjectApi } from './projectApi';
import type { Project, ProjectSummary } from './contracts';
import { DEFAULT_PROJECT_QUERY, PROJECT_POINTER_PREFIX } from './config';
import type { ProjectQuery } from './config';
import { ProjectContext } from './projectContext';
import { captureWorkspace, workspaceInputKey } from './snapshot';
import type { DescriptorState } from '../descriptors/useDescriptors';
import { LabContext } from '../design-lab/context';
import { draftFingerprint } from '../design-lab/state';
import { sha256 } from '../design-lab/zip';

interface State { owner: string | null; active: Project | null; items: ProjectSummary[]; nextPageToken: string | null; listing: ProjectQuery; busy: boolean; error: ApiError | null; notice: 'saved' | 'opened' | 'deleted' | 'duplicated' | null }
const EMPTY: State = { owner: null, active: null, items: [], nextPageToken: null, listing: DEFAULT_PROJECT_QUERY, busy: false, error: null, notice: null };

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
  const lab = useContext(LabContext);
  const [labBinding,setLabBinding]=useState<{owner:string;project:Project;revision:number}|null>(null);
  const labCurrent=useRef(lab);
  useLayoutEffect(()=>{labCurrent.current=lab;},[lab]);
  const sequence = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const { setText, setProfileWindow, setSource } = sequence;
  const { update } = alignment;
  const inputRevision = useRef(0);
  // Track raw edits and provenance, including formatting and parameter changes.
  // Background calculations do not invalidate a deliberate open.
  useLayoutEffect(() => { inputRevision.current++; }, [sequence.text, sequence.profileWindow, sequence.source, alignment.first, alignment.second, alignment.matrix, alignment.mode]);
  const [configuredApi] = useState(() => { const url = readApiBaseUrl(); return url ? createProjectApi(url) : null; });
  const client = api === undefined ? configuredApi : api;
  const user = auth.status === 'signed-in' ? auth.session?.user.id ?? null : null;
  const token = auth.session?.accessToken ?? '';
  const [state, setState] = useState<State>(EMPTY);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const current = state.owner === user ? state : EMPTY;
  const laboratory = labBinding?.owner===user && labBinding.revision===lab?.revision ? labBinding.project : null;

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
    const epoch = ++generation.current;
    const cleanupGeneration = generation;
    const operation = new AbortController();
    controller.current?.abort();
    controller.current = operation;
    locked.current = Boolean(user && client);
    const id = user ? lastProject(user) : null;
    // The last project resumes only over untouched drafts: empty, or still the examples the application opens with.
    const sequenceUntouched = (!sequence.text || sequence.text === DEFAULT_EXAMPLE.text)
      && sequence.profileWindow === DEFAULT_HYDROPATHY_WINDOW
      && (!sequence.source || sequence.source === DEFAULT_EXAMPLE.source);
    const alignmentUntouched = ((!alignment.first && !alignment.second)
      || (alignment.first === EXAMPLE_ALIGNMENT_INPUT.first && alignment.second === EXAMPLE_ALIGNMENT_INPUT.second))
      && alignment.matrix === DEFAULT_MATRIX && alignment.mode === DEFAULT_MODE;
    const canRestore = sequenceUntouched && alignmentUntouched;
    const resumeRevision = inputRevision.current;
    queueMicrotask(() => { setState({ ...EMPTY, owner: user, busy: Boolean(user && client) }); });
    if (user && client) {
      void (async () => {
        try {
          const listing = await client.list(token, '', operation.signal);
          const project = id && canRestore && resumeRevision === inputRevision.current && !operation.signal.aborted
            ? await client.open(id, token, operation.signal) : null;
          if (epoch !== generation.current) return;
          const resumed = resumeRevision === inputRevision.current ? project : null;
          if (resumed) restore(resumed);
          setState({ ...EMPTY, owner: user, active: resumed, items: listing.items, nextPageToken: listing.nextPageToken, notice: resumed ? 'opened' : null });
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
  async function relist(service: ProjectApi, signal: AbortSignal): Promise<void> {
    try {
      const listing = await service.list(token, '', signal, current.listing);
      if (!signal.aborted) setState(value => ({ ...value, items: listing.items, nextPageToken: listing.nextPageToken }));
    } catch (error) {
      // A completed write stays completed even when refreshing the list fails. Never invite a blind create retry.
      if (!signal.aborted) setState(value => ({ ...value, error: error instanceof ApiError ? error : new ApiError('unknown') }));
    }
  }
  const value = {
    laboratory,
    enabled: client !== null, active: current.active, items: current.items, nextPageToken: current.nextPageToken,
    busy: current.busy, error: current.error, notice: current.notice, dirty, listing: current.listing,
    refresh(more = false, query: ProjectQuery = current.listing) { return run(async (service, signal) => {
      const selected = more ? current.listing : { ...query, query: query.query.trim() };
      if (!more) setState(value => ({ ...value, items: [], nextPageToken: null, listing: selected }));
      const listing = await service.list(token, more ? current.nextPageToken ?? '' : '', signal, selected);
      if (signal.aborted) return;
      setState((value) => ({ ...value, items: more ? [...value.items, ...listing.items.filter((item) => !value.items.some((existing) => item.id === existing.id))] : listing.items, nextPageToken: listing.nextPageToken }));
    }); },
    async open(id: string, destination?: 'laboratory'): Promise<Project | null> {
      let opened: Project | null = null;
      const done = await run(async (service, signal) => {
      const openingRevision = inputRevision.current;
      const openingLab = labCurrent.current;
      const openingDrafts = openingLab ? draftFingerprint(openingLab.drafts) : null;
      const project = await service.open(id, token, signal);
      if (signal.aborted) return;
      if(destination==='laboratory'){
        const snapshot=project.workspace.laboratory;
        if(!snapshot || !lab)throw new ApiError('validation');
        const latestLab = labCurrent.current;
        const untouched = latestLab?.revision === openingLab?.revision && draftFingerprint(latestLab?.drafts ?? {}) === openingDrafts
          && latestLab?.status !== 'loading' && latestLab?.status !== 'exporting';
        // The built-in example loading in the background is not user work; an import or an edit is.
        if (!latestLab || !(untouched || latestLab.replaceable)) throw new ApiError('draft-changed');
        signal.addEventListener('abort',lab.cancel,{once:true});
        let revision:number|null;
        try{revision=await lab.openDocument(new TextEncoder().encode(snapshot.documentJson).buffer,snapshot.documentSha256);}
        finally{signal.removeEventListener('abort',lab.cancel);}
        signal.throwIfAborted();
        if(revision===null)throw new ApiError('validation');
        if(user)setLabBinding({owner:user,project,revision}); opened=project;
        setState(value=>({...value,notice:'opened'})); return;
      }
      if (openingRevision !== inputRevision.current) throw new ApiError('draft-changed');
      restore(project); if (user) remember(user, project.id);
      opened = project;
      setState((value) => ({ ...value, active: project, notice: 'opened' }));
      });
      return done ? opened : null;
    },
    save(name: string, descriptors?: DescriptorState, copy = false) { return run(async (service, signal) => {
      const snapshot = captureWorkspace(sequence.text, alignment, sequence.profileWindow, descriptors, current.active, sequence.source);
      const project = await service.save({ ...snapshot, name: name.trim() }, token, copy ? undefined : current.active ?? undefined, signal);
      if (signal.aborted) return;
      if (user) remember(user, project.id);
      setState((value) => ({ ...value, active: project, notice: 'saved', items: [project, ...value.items.filter((item) => item.id !== project.id)] }));
      await relist(service, signal);
    }); },
    saveLaboratory(name:string,copy=false){return run(async(service,signal)=>{
      if(!lab?.dataset)throw new ApiError('validation');
      const fingerprint=draftFingerprint(lab.drafts), revision=lab.revision;
      const bytes=await lab.document(); signal.throwIfAborted();
      if(!bytes)throw new ApiError('validation');
      if(bytes.byteLength>1_000_000)throw new ApiError('laboratory-size');
      const laboratory={schemaVersion:1 as const,documentJson:new TextDecoder().decode(bytes),documentSha256:await sha256(bytes)};
      const base=value.laboratory;
      const workspace={...(base?.workspace ?? {profileWindow:9 as const,descriptors:null,source:null,alignment:{first:'',second:'',matrix:'BLOSUM62' as const,mode:'global' as const,result:null}}),schemaVersion:2 as const,laboratory};
      const project=await service.save({name:name.trim(),activeSequence:base?.activeSequence ?? lab.drafts[lab.activeId]?.sequence ?? '',workspace},token,copy?undefined:base??undefined,signal);
      signal.throwIfAborted();
      if(project.workspace.laboratory?.documentSha256!==laboratory.documentSha256 || project.workspace.laboratory.documentJson!==laboratory.documentJson)throw new ApiError('invalid-response');
      if(labCurrent.current?.revision===revision){if(user)setLabBinding({owner:user,project,revision});labCurrent.current.markSaved(fingerprint);}
      setState(v=>({...v,notice:'saved'})); await relist(service,signal);
    });},
    rename(project: ProjectSummary, name: string) { return run(async (service, signal) => {
      const stored = await service.open(project.id, token, signal);
      signal.throwIfAborted();
      if (stored.updatedAt !== project.updatedAt) throw new ApiError('conflict');
      if (current.active?.id === project.id && current.active.updatedAt !== stored.updatedAt) throw new ApiError('conflict');
      const updated = await service.save({ name: name.trim(), activeSequence: stored.activeSequence, workspace: stored.workspace }, token, project, signal);
      if (signal.aborted) return;
      setLabBinding(binding=>binding?.project.id===updated.id?{...binding,project:updated}:binding);
      setState((value) => ({ ...value, active: value.active?.id === project.id ? { ...value.active, name: updated.name, updatedAt: updated.updatedAt } : value.active, items: value.items.map((item) => item.id === project.id ? updated : item), notice: 'saved' }));
      await relist(service, signal);
    }); },
    duplicate(project: ProjectSummary, name: string) { return run(async (service, signal) => {
      const stored = await service.open(project.id, token, signal);
      if (signal.aborted) return;
      if (stored.updatedAt !== project.updatedAt) throw new ApiError('conflict');
      await service.save({ name: name.trim(), activeSequence: stored.activeSequence, workspace: stored.workspace }, token, undefined, signal);
      signal.throwIfAborted();
      setState(value => ({ ...value, notice: 'duplicated' }));
      await relist(service, signal);
    }); },
    remove(project: ProjectSummary) { return run(async (service, signal) => {
      await service.remove(project.id, project.updatedAt, token, signal);
      if (signal.aborted) return;
      if (current.active?.id === project.id && user) remember(user, null);
      setLabBinding(binding=>binding?.project.id===project.id?null:binding);
      setState((value) => ({ ...value, active: value.active?.id === project.id ? null : value.active, items: value.items.filter((item) => item.id !== project.id), notice: 'deleted' }));
      await relist(service, signal);
    }); },
    detach() { if (locked.current) return; if (user) remember(user, null); setState((value) => ({ ...value, active: null, error: null, notice: null })); },
  };
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

