import { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import { ApiError } from '../api/errors';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import type { DescriptorState } from '../descriptors/useDescriptors';
import { LabContext } from '../design-lab/context';
import { draftFingerprint } from '../design-lab/state';
import { sha256 } from '../design-lab/zip';
import type { LiveConnector } from '../live/liveChannel';
import type { ProjectApi } from './projectApi';
import type { Project, ProjectSummary } from './contracts';
import { PROJECT_SHARE_DEFAULT_DAYS, readCreateIdempotency } from './config';
import type { ProjectQuery, ProjectShareDuration } from './config';
import { ProjectContext } from './projectContext';
import { captureWorkspace, workspaceInputKey, workspaceVersion } from './snapshot';
import { isRetryable } from './syncQueue';
import type { SyncEntry } from './syncQueue';
import { ActionGate, EMPTY, EMPTY_WORKSPACE, remember, written } from './projectState';
import type { ProjectCore, State } from './projectState';
import { useProjectService } from './useProjectService';
import { useQueueFlush, useSyncQueue } from './useSyncQueue';
import { useLiveProjects } from './useLiveProjects';
import { useDesignTarget } from './useDesignTarget';
import { useLeaveGuards } from './useLeaveGuards';
import { useResume } from './useResume';

/** Holds no private sequence in browser storage. On reload, retrieves the last project with the user's JWT. */
export function ProjectProvider({ children, api, live }: { children: ReactNode; api?: ProjectApi | null; live?: LiveConnector | null }): React.JSX.Element {
  const auth = useAuth();
  const lab = useContext(LabContext);
  const [labBinding,setLabBinding]=useState<{owner:string;project:Project;revision:number}|null>(null);
  const labCurrent=useRef(lab);
  useLayoutEffect(()=>{labCurrent.current=lab;},[lab]);
  const sequence = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const inputRevision = useRef(0);
  // Track raw edits and provenance, including formatting and parameter changes.
  // Background calculations do not invalidate a deliberate open.
  useLayoutEffect(() => { inputRevision.current++; }, [sequence.text, sequence.profileWindow, sequence.source, alignment.first, alignment.second, alignment.matrix, alignment.mode]);
  const { client, enabled, serviceClient } = useProjectService(api, auth.status === 'signed-in');
  const user = auth.status === 'signed-in' ? auth.session?.user.id ?? null : null;
  const [gate] = useState(() => new ActionGate());
  useLayoutEffect(() => {
    gate.changeOwner();
    return () => { gate.changeOwner(); };
  }, [user, gate]);
  const token = auth.session?.accessToken ?? '';
  const email = auth.session?.user.email ?? '';
  const [state, setState] = useState<State>(EMPTY);
  const current = state.owner === user ? state : EMPTY;
  const laboratory = labBinding?.owner===user && labBinding.revision===lab?.revision ? labBinding.project : null;
  const [idempotent] = useState(readCreateIdempotency);
  const core: ProjectCore = { user, email, token, enabled, idempotent, client, serviceClient, gate, setState };
  const sync = useSyncQueue(core);
  const { queue, bound, boundRef, bind, openEntry, shownEntry, entryFor, watched, queueChange, connection, poke } = sync;
  /** The laboratory stays bound to a project that was just written elsewhere on this screen. */
  const follow = useCallback((project: Project) => { setLabBinding(binding => binding?.project.id === project.id ? { ...binding, project } : binding); }, []);

  const restore = useResume(core, sequence, alignment, inputRevision, watched, poke);
  useLeaveGuards(current.active, user, sequence, alignment);

  async function run(task: (client: ProjectApi, signal: AbortSignal) => Promise<void>): Promise<boolean> {
    if (!enabled || !user || !token || gate.locked) return false;
    // Hold the lock across the wait for the client, so a second action cannot start meanwhile.
    gate.lock();
    const startingOwner = gate.owner;
    let service: ProjectApi | null;
    try { service = client ?? await serviceClient(); }
    catch (error) {
      if (gate.owner !== startingOwner) return false;
      gate.lock(false);
      setState((value) => ({ ...value, owner: user, error: error instanceof ApiError ? error : new ApiError('unknown'), attempt: value.attempt + 1 }));
      return false;
    }
    if (gate.owner !== startingOwner) return false;
    if (!service) { gate.lock(false); return false; }
    const epoch = gate.advance();
    const operation = new AbortController();
    gate.replace(operation);
    setState((value) => ({ ...value, owner: user, busy: true, error: null, notice: null, attempt: value.attempt + 1 }));
    try {
      await task(watched(service), operation.signal);
      return !operation.signal.aborted && gate.epoch === epoch;
    } catch (error) {
      if (!operation.signal.aborted && gate.epoch === epoch) setState((value) => ({ ...value, error: error instanceof ApiError ? error : new ApiError('unknown') }));
      return false;
    } finally {
      if (gate.epoch === epoch) { gate.lock(false); setState((value) => ({ ...value, busy: false })); poke(); }
    }
  }
  async function relist(service: ProjectApi, signal: AbortSignal): Promise<void> {
    try {
      const listing = await service.list(token, '', signal, current.listing);
      if (!signal.aborted) setState(value => ({ ...value, items: listing.items, nextPageToken: listing.nextPageToken }));
    } catch (error) {
      // A completed write stays completed even when refreshing the list fails. Never invite a blind create retry.
      if (!signal.aborted) setState(value => ({ ...value, error: error instanceof ApiError ? error : new ApiError('unknown') }));
    }
  }
  /** What a landed entry changes on screen: the drafts it came from now belong to the stored project. */
  function landed(entry: SyncEntry, project: Project, owner: string): void {
    setState(value => value.owner !== owner ? value : { ...value, active: boundRef.current.analysis === entry.key || value.active?.id === project.id ? project : value.active });
    if (boundRef.current.analysis === entry.key) { remember(owner, project.id); bind('analysis', null); }
    const marker = entry.laboratory;
    if (boundRef.current.laboratory === entry.key) {
      bind('laboratory', null);
      if (marker && labCurrent.current?.revision === marker.revision) { setLabBinding({ owner, project, revision: marker.revision }); labCurrent.current.markSaved(marker.fingerprint); }
    } else follow(project);
  }
  useQueueFlush(core, sync, auth.session?.expiresAt ?? null, relist, landed);
  const remoteChange = useLiveProjects(core, live, current, sync.wake, poke);
  const design = useDesignTarget(core, current, run, relist, sync, follow);

  const dirty = Boolean(current.active && workspaceInputKey(sequence.text, alignment, sequence.profileWindow) !== workspaceInputKey(current.active.activeSequence, current.active.workspace.alignment, current.active.workspace.profileWindow));
  /** Reads that change nothing this tab holds take no lock, so they can run while another action does. */
  const read = async <T,>(pick: (service: ProjectApi) => ((id: string, token: string) => Promise<T>) | undefined, id: string): Promise<T> => {
    const service = client ?? await serviceClient();
    const method = service ? pick(service) : undefined;
    if (!method || !token) throw new ApiError(token ? 'unavailable' : 'session');
    return method(id, token);
  };
  /** Keeps the card's "shared until" line in step with a link just started or ended, without listing again. */
  const shared = (id: string, expiresAt: string | null): void => {
    setState(value => ({ ...value, items: value.items.map(item => item.id === id ? { ...item, shareExpiresAt: expiresAt } : item) }));
  };
  const value = {
    ...design, ...sync.actions, laboratory, remoteChange,
    enabled, active: current.active, items: current.items, nextPageToken: current.nextPageToken,
    busy: current.busy || sync.syncing, error: current.error, notice: current.notice, attempt: current.attempt, dirty, listing: current.listing,
    connection, pending: queue, syncing: sync.syncing,
    queuedAnalysis: shownEntry(bound.analysis), queuedLaboratory: shownEntry(bound.laboratory),
    resolve: (key: string, choice: Parameters<typeof sync.actions.resolve>[1], copyName: string) => sync.actions.resolve(key, choice, copyName, (id) => value.open(id), follow),
    refresh(more = false, query: ProjectQuery = current.listing) { return run(async (service, signal) => {
      const selected = more ? current.listing : { ...query, query: query.query.trim() };
      // The open list stays until the new one arrives: without a connection it is all there is.
      const listing = await service.list(token, more ? current.nextPageToken ?? '' : '', signal, selected);
      if (signal.aborted) return;
      setState((value) => ({ ...value, listing: selected, items: more ? [...value.items, ...listing.items.filter((item) => !value.items.some((existing) => item.id === existing.id))] : listing.items, nextPageToken: listing.nextPageToken }));
    }); },
    async open(id: string, destination?: 'laboratory'): Promise<Project | null> {
      let opened: Project | null = null;
      const done = await run(async (service, signal) => {
      const openingRevision = inputRevision.current;
      const openingLab = labCurrent.current;
      const openingDrafts = openingLab ? draftFingerprint(openingLab.drafts,openingLab.predictions) : null;
      const project = await service.open(id, token, signal);
      if (signal.aborted) return;
      if(destination==='laboratory'){
        const snapshot=project.workspace.laboratory;
        if(!snapshot || !lab)throw new ApiError('validation');
        const latestLab = labCurrent.current;
        const untouched = latestLab?.revision === openingLab?.revision && draftFingerprint(latestLab?.drafts ?? {},latestLab?.predictions) === openingDrafts
          && latestLab?.status !== 'loading' && latestLab?.status !== 'exporting';
        // The built-in example loading in the background is not user work; an import or an edit is.
        if (!latestLab || !(untouched || latestLab.replaceable)) throw new ApiError('draft-changed');
        signal.addEventListener('abort',lab.cancel,{once:true});
        let revision:number|null;
        try{revision=await lab.openDocument(new TextEncoder().encode(snapshot.documentJson).buffer,snapshot.documentSha256);}
        finally{signal.removeEventListener('abort',lab.cancel);}
        signal.throwIfAborted();
        if(revision===null)throw new ApiError('validation');
        if(user)setLabBinding({owner:user,project,revision}); opened=project; bind('laboratory',null);
        setState(value=>({...value,notice:'opened'})); return;
      }
      if (openingRevision !== inputRevision.current) throw new ApiError('draft-changed');
      restore(project); if (user) remember(user, project.id);
      bind('analysis', null);
      opened = project;
      setState((value) => ({ ...value, active: project, notice: 'opened' }));
      });
      return done ? opened : null;
    },
    save(name: string, descriptors?: DescriptorState, copy = false) { return run(async (service, signal) => {
      // A save of the same project still waiting is replaced, keeping what that entry already carries.
      const queued = copy ? null : openEntry(boundRef.current.analysis) ?? entryFor(current.active?.id);
      // A waiting search carries no base of its own: the open project is the version it was added to.
      const base = copy ? null : queued ? queued.base ?? (queued.projectId === current.active?.id ? current.active : null) : current.active;
      const projectId = copy ? null : queued?.projectId ?? base?.id ?? null;
      const view = base && queued?.write ? { ...base, workspace: queued.write.workspace } : base;
      const snapshot = await captureWorkspace(sequence.text, alignment, sequence.profileWindow, descriptors, view, sequence.source);
      const write = { ...snapshot, name: name.trim() };
      const change = { projectId, base, name: write.name, kind: 'analysis' as const, write };
      if (queued || connection === 'offline') { if (!queueChange({ ...change, uncertain: false }, 'analysis', copy)) throw new ApiError('network'); return; }
      const requestId = crypto.randomUUID();
      let project: Project;
      try { project = await service.save(write, token, base ?? undefined, signal, !base && idempotent ? requestId : undefined); }
      catch (error) {
        if (signal.aborted || !(error instanceof ApiError) || !isRetryable(error.code) || !queueChange({ ...change, uncertain: !base, failed: error.code }, 'analysis', copy, requestId)) throw error;
        return;
      }
      if (signal.aborted) return;
      if (user) remember(user, project.id);
      setState((value) => ({ ...value, active: project, notice: 'saved', items: [project, ...value.items.filter((item) => item.id !== project.id)] }));
      await relist(service, signal);
    }); },
    saveLaboratory(name:string,copy=false){return run(async(service,signal)=>{
      if(!lab?.dataset)throw new ApiError('validation');
      const fingerprint=draftFingerprint(lab.drafts,lab.predictions), revision=lab.revision;
      const bytes=await lab.document(); signal.throwIfAborted();
      if(!bytes)throw new ApiError('validation');
      if(bytes.byteLength>1_000_000)throw new ApiError('laboratory-size');
      const laboratory={schemaVersion:1 as const,documentJson:new TextDecoder().decode(bytes),documentSha256:await sha256(bytes)};
      const queued=copy?null:openEntry(boundRef.current.laboratory)??entryFor(value.laboratory?.id);
      const base=copy?null:queued?queued.base??(queued.projectId===value.laboratory?.id?value.laboratory:null):value.laboratory;
      const projectId=copy?null:queued?.projectId??base?.id??null;
      // A copy starts from the bound project's analysis, as before; a waiting save of it is the latest content.
      const stored=queued?.write ?? (copy?value.laboratory:base);
      const fields={...(stored?.workspace ?? EMPTY_WORKSPACE),laboratory};
      // Keeps a saved generator history and never lowers the stored version.
      const workspace={...fields,schemaVersion:workspaceVersion(fields,stored?.workspace.schemaVersion)};
      const write={name:name.trim(),activeSequence:stored?.activeSequence ?? lab.drafts[lab.activeId]?.sequence ?? '',workspace};
      const change={projectId,base,name:write.name,kind:'laboratory' as const,write,laboratory:{revision,fingerprint,variants:Object.keys(lab.drafts).length}};
      if(queued || connection==='offline'){if(!queueChange({...change,uncertain:false},'laboratory',copy))throw new ApiError('network');return;}
      const requestId=crypto.randomUUID();
      let project:Project;
      try{project=await service.save(write,token,base??undefined,signal,!base&&idempotent?requestId:undefined);}
      catch(error){
        if(signal.aborted || !(error instanceof ApiError) || !isRetryable(error.code) || !queueChange({...change,uncertain:!base,failed:error.code},'laboratory',copy,requestId))throw error;
        return;
      }
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
      follow(updated);
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
      setState((value) => ({ ...value, active: value.active?.id === project.id ? null : value.active, searchProject: value.searchProject?.id === project.id ? null : value.searchProject, items: value.items.filter((item) => item.id !== project.id), notice: 'deleted' }));
      await relist(service, signal);
    }); },
    versions: (id: string) => read(service => service.versions && ((projectId: string, key: string) => watched(service).versions?.(projectId, key) ?? Promise.resolve([])), id),
    share: (id: string) => read(service => service.share, id),
    async createShare(id: string, days: ProjectShareDuration = PROJECT_SHARE_DEFAULT_DAYS) {
      const created = await read(service => { const create = service.createShare; return create && ((projectId: string, key: string) => create(projectId, key, days)); }, id);
      shared(id, created.share.expiresAt);
      return created;
    },
    async removeShare(id: string): Promise<void> { await read(service => service.removeShare, id); shared(id, null); },
    restoreVersion(project: ProjectSummary, versionId: string) { return run(async (service, signal) => {
      if (!service.restore) throw new ApiError('unavailable');
      const restored = await service.restore(project.id, versionId, project.updatedAt, token, signal);
      if (signal.aborted) return;
      // The project open in Analyze shows the content it now has; the confirmation said so.
      if (current.active?.id === restored.id) { restore(restored); if (user) remember(user, restored.id); bind('analysis', null); }
      setState(value => ({ ...written(restored)(value), items: value.items.map(item => item.id === restored.id ? restored : item), notice: 'restored' }));
      await relist(service, signal);
    }); },
    detach() { if (gate.locked) return; if (user) remember(user, null); bind('analysis', null); setState((value) => ({ ...value, active: null, error: null, notice: null })); },
  };
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
