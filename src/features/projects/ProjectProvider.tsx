import { DEFAULT_EXAMPLE } from '../editor/examples';
import { EXAMPLE_ALIGNMENT_INPUT } from '../alignment/examples';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/errors';
import { useSequenceDraft } from '../editor/sequenceDraft';
import type { SequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import type { AlignmentDraft } from '../alignment/alignmentDraft';
import { DEFAULT_MATRIX, DEFAULT_MODE, SCORING_SUBSTITUTIONS } from '../alignment/config';
import { DEFAULT_HYDROPATHY_WINDOW } from '../descriptors/config';
import type { ProjectApi } from './projectApi';
import type { Project, ProjectSummary } from './contracts';
import { DEFAULT_PROJECT_QUERY, MAX_PROJECT_NAME_LENGTH, PROJECT_POINTER_PREFIX, readCreateIdempotency } from './config';
import type { ProjectQuery } from './config';
import { ProjectContext } from './projectContext';
import { captureWorkspace, withGeneratorHistory, workspaceInputKey, workspaceVersion } from './snapshot';
import type { GeneratorRunSaved, GeneratorRunTarget } from './projectContext';
import type { GeneratorRun, GeneratorRunSelection } from '../generator/history';
import type { ProjectWrite } from './contracts';
import { afterFailure, due, enqueue, isOpen, isRetryable, newKey, nextRetry, sameContent } from './syncQueue';
import type { ConflictChoice, SyncChange, SyncEntry } from './syncQueue';

/**
 * The generator history is written in zod and is only read when a search result is stored or
 * removed, never while rendering, so it arrives with that action. Together with the project
 * contracts this keeps zod out of the initial download; see `docs/performance-2026-10-27.md`.
 */
let loadingHistory: Promise<typeof import('../generator/history')> | null = null;
const historyModule = (): Promise<typeof import('../generator/history')> => (loadingHistory ??= import('../generator/history'));
import { APP_BUILD } from '../generator/appBuild';
import type { WorkspaceSnapshot } from './contracts';
import type { DescriptorState } from '../descriptors/useDescriptors';
import { LabContext } from '../design-lab/context';
import { draftFingerprint } from '../design-lab/state';
import { sha256 } from '../design-lab/zip';

interface State { owner: string | null; active: Project | null; items: ProjectSummary[]; nextPageToken: string | null; listing: ProjectQuery; busy: boolean; error: ApiError | null; notice: 'saved' | 'opened' | 'deleted' | 'duplicated' | null; attempt: number }
/** A project created only to keep generator searches starts without analysis or comparison. */
const EMPTY_WORKSPACE: WorkspaceSnapshot = { schemaVersion: 1, profileWindow: DEFAULT_HYDROPATHY_WINDOW, source: null, descriptors: null, alignment: { first: '', second: '', matrix: DEFAULT_MATRIX, mode: DEFAULT_MODE, result: null } };
const EMPTY: State = { owner: null, active: null, items: [], nextPageToken: null, listing: DEFAULT_PROJECT_QUERY, busy: false, error: null, notice: null, attempt: 0 };

function remember(owner: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(`${PROJECT_POINTER_PREFIX}${owner}`, id);
    else localStorage.removeItem(`${PROJECT_POINTER_PREFIX}${owner}`);
  } catch { /* Private contexts may disable storage; server persistence still works. */ }
}
/** True while both drafts are empty or still hold the examples the application opens with. */
function untouchedDrafts(sequence: SequenceDraft, alignment: AlignmentDraft): boolean {
  const sequenceUntouched = (!sequence.text || sequence.text === DEFAULT_EXAMPLE.text)
    && sequence.profileWindow === DEFAULT_HYDROPATHY_WINDOW
    && (!sequence.source || sequence.source === DEFAULT_EXAMPLE.source);
  const alignmentUntouched = ((!alignment.first && !alignment.second)
    || (alignment.first === EXAMPLE_ALIGNMENT_INPUT.first && alignment.second === EXAMPLE_ALIGNMENT_INPUT.second))
    && alignment.matrix === DEFAULT_MATRIX && alignment.mode === DEFAULT_MODE;
  return sequenceUntouched && alignmentUntouched;
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
  // The service client carries the generated contracts, which a visit that never opens a project
  // does not need. It is fetched on sign-in; an action that arrives
  // before it lands waits for the same request instead of failing silently.
  const [configuredUrl] = useState(readApiBaseUrl);
  const [configuredApi, setConfiguredApi] = useState<ProjectApi | null>(null);
  const loading = useRef<Promise<ProjectApi | null> | null>(null);
  const serviceClient = useCallback(async (): Promise<ProjectApi | null> => {
    if (api !== undefined) return api;
    if (!configuredUrl) return null;
    loading.current ??= import('./projectApi').then(({ createProjectApi }) => createProjectApi(configuredUrl));
    try {
      const resolved = await loading.current;
      setConfiguredApi(resolved);
      return resolved;
    } catch {
      // The file may be unreachable offline or after a replaced build; let the next action try again.
      loading.current = null;
      throw new ApiError('network');
    }
  }, [api, configuredUrl]);
  useEffect(() => {
    if (auth.status === 'signed-in') void serviceClient().catch(() => undefined);
  }, [auth.status, serviceClient]);
  const client = api === undefined ? configuredApi : api;
  const enabled = api === undefined ? Boolean(configuredUrl) : api !== null;
  const user = auth.status === 'signed-in' ? auth.session?.user.id ?? null : null;
  const ownerRevision = useRef(0);
  useLayoutEffect(() => {
    const revision = ownerRevision;
    revision.current++;
    return () => { revision.current++; };
  }, [user]);
  const token = auth.session?.accessToken ?? '';
  const email = auth.session?.user.email ?? '';
  const [state, setState] = useState<State>(EMPTY);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const current = state.owner === user ? state : EMPTY;
  const laboratory = labBinding?.owner===user && labBinding.revision===lab?.revision ? labBinding.project : null;

  // Saves waiting for the connection (RF-15): tab memory only, kept across a session that ends while offline.
  const [idempotent] = useState(readCreateIdempotency);
  const [queue, setQueue] = useState<SyncEntry[]>([]);
  const queueRef = useRef<SyncEntry[]>([]);
  // The entries that the Analyze/Compare drafts and the laboratory feed, so a second save replaces them.
  const [bound, setBound] = useState<{ analysis: string | null; laboratory: string | null }>({ analysis: null, laboratory: null });
  const boundRef = useRef(bound);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  // navigator.onLine only says a network exists; the API answering, or failing to, says whether it is reachable.
  const [unreachable, setUnreachable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [wake, setWake] = useState(0);
  const connection = online && !unreachable ? 'online' as const : 'offline' as const;
  const commit = useCallback((next: SyncEntry[]) => { queueRef.current = next; setQueue(next); }, []);
  const patch = useCallback((key: string, changes: Partial<SyncEntry>) => { commit(queueRef.current.map(entry => entry.key === key ? { ...entry, ...changes } : entry)); }, [commit]);
  const bind = useCallback((slot: 'analysis' | 'laboratory', key: string | null) => {
    boundRef.current = { ...boundRef.current, [slot]: key };
    setBound(boundRef.current);
  }, []);
  const openEntry = (key: string | null): SyncEntry | null => queue.find(entry => entry.key === key && entry.owner === user && isOpen(entry)) ?? null;
  // After a session that ended offline the bound saves stay visible, so the panel can ask for the same account.
  const shownEntry = (key: string | null): SyncEntry | null => queue.find(entry => entry.key === key && (user === null || entry.owner === user) && isOpen(entry)) ?? null;
  // Another account never inherits the bound saves of the previous one.
  useEffect(() => {
    if (!user) return;
    for (const slot of ['analysis', 'laboratory'] as const) {
      const key = boundRef.current[slot];
      if (key && !queueRef.current.some(entry => entry.key === key && entry.owner === user)) bind(slot, null);
    }
  }, [user, bind]);
  const entryFor = (id: string | null | undefined): SyncEntry | null => id ? queue.find(entry => entry.projectId === id && entry.owner === user && isOpen(entry)) ?? null : null;
  useEffect(() => {
    const again = (): void => { setWake(value => value + 1); };
    const up = (): void => { setOnline(true); setUnreachable(false); again(); };
    const down = (): void => { setOnline(false); };
    const visible = (): void => { if (document.visibilityState === 'visible') again(); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); document.removeEventListener('visibilitychange', visible); };
  }, []);
  // Every answer from the API wakes the queue; a failed fetch marks the API unreachable.
  const watched = useCallback((service: ProjectApi): ProjectApi => {
    const observe = <T,>(request: Promise<T>): Promise<T> => request.then(
      (result) => { setUnreachable(false); setWake(value => value + 1); return result; },
      (error: unknown) => { if (error instanceof ApiError && error.code === 'network') setUnreachable(true); throw error; },
    );
    return {
      list: (...args) => observe(service.list(...args)), open: (...args) => observe(service.open(...args)),
      save: (...args) => observe(service.save(...args)), remove: (...args) => observe(service.remove(...args)),
    };
  }, []);
  /** Queues a change when it cannot be sent now; returns false when the queue is full. */
  function queueChange(change: Omit<SyncChange, 'owner' | 'email'>, slot: 'analysis' | 'laboratory' | null, copy: boolean, requestId: string = crypto.randomUUID()): boolean {
    if (!user) return false;
    const result = enqueue(queueRef.current, { ...change, owner: user, email }, Date.now(), slot && !copy ? boundRef.current[slot] : null, requestId);
    if (!result) return false;
    commit(result.entries);
    if (slot) bind(slot, result.key);
    setState(value => ({ ...value, owner: user, notice: null, error: null }));
    setWake(value => value + 1);
    return true;
  }

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
          if (epoch !== generation.current) return;
          const resumed = resumeRevision === inputRevision.current ? project : null;
          if (resumed) restore(resumed);
          setState({ ...EMPTY, owner: user, active: resumed, items: listing.items, nextPageToken: listing.nextPageToken, notice: resumed ? 'opened' : null });
        } catch (error) {
          if (epoch !== generation.current) return;
          const failure = error instanceof ApiError ? error : new ApiError('unknown');
          if (failure.code === 'not-found' && user) remember(user, null);
          setState({ ...EMPTY, owner: user, error: failure });
        } finally { if (epoch === generation.current) { locked.current = false; setWake(value => value + 1); } }
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

  // Without an open project the drafts exist only in this tab, so leaving with the visitor's own input asks first (the browser's own prompt).
  const ownInput = !untouchedDrafts(sequence, alignment);
  useEffect(() => {
    if (current.active || !ownInput) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); };
  }, [current.active, ownInput]);

  // Waiting saves exist only in this tab, so closing or reloading it asks first (the browser's own prompt).
  const unsent = queue.some(isOpen);
  useEffect(() => {
    if (!unsent) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); };
  }, [unsent]);

  async function run(task: (client: ProjectApi, signal: AbortSignal) => Promise<void>): Promise<boolean> {
    if (!enabled || !user || !token || locked.current) return false;
    // Hold the lock across the wait for the client, so a second action cannot start meanwhile.
    locked.current = true;
    const startingOwner = ownerRevision.current;
    let service: ProjectApi | null;
    try { service = client ?? await serviceClient(); }
    catch (error) {
      if (ownerRevision.current !== startingOwner) return false;
      locked.current = false;
      setState((value) => ({ ...value, owner: user, error: error instanceof ApiError ? error : new ApiError('unknown'), attempt: value.attempt + 1 }));
      return false;
    }
    if (ownerRevision.current !== startingOwner) return false;
    if (!service) { locked.current = false; return false; }
    const epoch = ++generation.current;
    const operation = new AbortController();
    controller.current?.abort(); controller.current = operation;
    setState((value) => ({ ...value, owner: user, busy: true, error: null, notice: null, attempt: value.attempt + 1 }));
    try {
      await task(watched(service), operation.signal);
      return !operation.signal.aborted && generation.current === epoch;
    } catch (error) {
      if (!operation.signal.aborted && generation.current === epoch) setState((value) => ({ ...value, error: error instanceof ApiError ? error : new ApiError('unknown') }));
      return false;
    } finally {
      if (generation.current === epoch) { locked.current = false; setState((value) => ({ ...value, busy: false })); setWake(value => value + 1); }
    }
  }

  /** A queued entry's write, with its searches added on top of the stored history; null when every search is already there. */
  async function compose(entry: SyncEntry, fresh: Project | null): Promise<ProjectWrite | null> {
    const start: ProjectWrite = entry.write ?? { name: fresh?.name ?? entry.name, activeSequence: fresh?.activeSequence ?? '', workspace: fresh?.workspace ?? EMPTY_WORKSPACE };
    if (!entry.runs.length) return start;
    const { addGeneratorRun } = await historyModule();
    let history = start.workspace.generatorHistory ?? null, added = false;
    for (const run of entry.runs) { const next = await addGeneratorRun(history, run); history = next.history; added ||= next.added; }
    if (!added && !entry.write && fresh) return null;
    return { ...start, workspace: await withGeneratorHistory(start.workspace, history) };
  }

  /** Sends one entry and describes the outcome; never throws. */
  async function send(service: ProjectApi, entry: SyncEntry, signal: AbortSignal): Promise<Partial<SyncEntry>> {
    const saved = (project: Project): Partial<SyncEntry> => ({ state: 'saved', saved: project, savedAt: Date.now(), projectId: project.id, error: null, remote: null, uncertain: false });
    let write: ProjectWrite | null = null;
    try {
      // Without request ids a create that may already exist is repeated only by the person, after checking the list.
      if (!entry.projectId && entry.uncertain && !idempotent) return { state: 'failed', error: 'network' };
      if (entry.projectId && !entry.write) {
        // Searches only: added to the version in the account now, which never conflicts.
        const fresh = await service.open(entry.projectId, token, signal);
        write = await compose(entry, fresh);
        return saved(write ? await service.save(write, token, fresh, signal) : fresh);
      }
      write = await compose(entry, null);
      if (!write) throw new ApiError('validation');
      if (entry.projectId) {
        // An existing project is always updated, never created again; without a known base the account version is the base.
        const base = entry.base ?? await service.open(entry.projectId, token, signal);
        return saved(await service.save(write, token, base, signal));
      }
      const requestId = idempotent ? entry.requestId : undefined;
      const created = await service.save(write, token, undefined, signal, requestId);
      // A repeated request id returns the project as first stored; content merged since then follows as an update.
      if (!requestId || sameContent(created, write)) return saved(created);
      try { return saved(await service.save(write, token, created, signal)); }
      catch (error) {
        if (signal.aborted) return { state: 'pending', projectId: created.id, base: created, uncertain: false };
        return { ...afterFailure(entry, error instanceof ApiError ? error.code : 'unknown', Date.now(), true), projectId: created.id, base: created, uncertain: false };
      }
    } catch (error) {
      // A create cut short may have reached the server: the same rule as a failed one applies.
      if (signal.aborted) return { state: 'pending', uncertain: entry.uncertain || !entry.projectId };
      const failure = error instanceof ApiError ? error : new ApiError('unknown');
      if (failure.code === 'conflict' && entry.projectId && entry.write && write) {
        try {
          const remote = await service.open(entry.projectId, token, signal);
          // A lost response leaves our own write stored: that is not a conflict.
          return sameContent(remote, write) ? saved(remote) : { state: 'conflict', remote, error: null };
        } catch (reading) {
          return afterFailure(entry, reading instanceof ApiError ? reading.code : 'unknown', Date.now(), true);
        }
      }
      // A search meeting another write is added again on the next read.
      const code = failure.code === 'conflict' && !entry.write ? 'unavailable' : failure.code;
      return { ...afterFailure(entry, code, Date.now(), entry.projectId !== null || idempotent), uncertain: !entry.projectId };
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
    } else setLabBinding(binding => binding?.project.id === project.id ? { ...binding, project } : binding);
  }

  /** Sends due entries one by one, in the order they were saved, under the same lock as every other action. */
  async function flush(): Promise<void> {
    if (!user || locked.current) return;
    const owner = user, startingOwner = ownerRevision.current;
    locked.current = true;
    let service: ProjectApi | null = null;
    try { service = client ?? await serviceClient(); } catch { /* Still unreachable; the next wake tries again. */ }
    if (!service || ownerRevision.current !== startingOwner) { if (ownerRevision.current === startingOwner) locked.current = false; return; }
    const tracked = watched(service);
    const epoch = ++generation.current;
    const operation = new AbortController();
    controller.current = operation;
    setSyncing(true);
    let stored = false;
    try {
      for (let entry = due(queueRef.current, owner, Date.now())[0]; entry; entry = due(queueRef.current, owner, Date.now())[0]) {
        patch(entry.key, { state: 'saving' });
        const outcome = await send(tracked, entry, operation.signal);
        patch(entry.key, outcome);
        if (operation.signal.aborted || generation.current !== epoch) break;
        if (outcome.state === 'saved' && outcome.saved) { stored = true; landed(entry, outcome.saved, owner); }
        // Nothing else gets through either; the next wake tries again.
        if (outcome.error === 'network') break;
      }
      if (stored && !operation.signal.aborted && generation.current === epoch) await relist(tracked, operation.signal);
    } finally {
      setSyncing(false);
      if (generation.current === epoch) { locked.current = false; setWake(value => value + 1); }
    }
  }

  // Sends when the network returns, the tab becomes visible, the API answers or a retry delay ends.
  useEffect(() => {
    if (!user || !token || !enabled || !online || locked.current) return;
    // An expired token waits for the session refresh, which changes the token and wakes this again.
    if (auth.session && auth.session.expiresAt * 1_000 <= Date.now()) return;
    const now = Date.now();
    if (due(queue, user, now).length) { void flush(); return; }
    const next = nextRetry(queue, user, now);
    if (next === null) return;
    const timer = window.setTimeout(() => { setWake(value => value + 1); }, next - now);
    return () => { window.clearTimeout(timer); };
    // flush reads the latest queue and drafts through refs; these are the moments to look again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, wake, user, token, enabled, online]);

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
    enabled, active: current.active, items: current.items, nextPageToken: current.nextPageToken,
    busy: current.busy || syncing, error: current.error, notice: current.notice, attempt: current.attempt, dirty, listing: current.listing,
    connection, pending: queue, syncing,
    queuedAnalysis: shownEntry(bound.analysis), queuedLaboratory: shownEntry(bound.laboratory),
    retry(key: string) {
      const entry = queueRef.current.find(item => item.key === key);
      if (!entry || entry.state !== 'failed') return;
      // The person asked again: a create that may exist is repeated once; a project deleted meanwhile is created anew.
      const gone = entry.error === 'not-found';
      patch(key, { state: 'pending', attempts: 0, retryAt: Date.now(), error: null, uncertain: false, ...(gone ? { projectId: null, base: null } : {}) });
    },
    discard(key: string) {
      commit(queueRef.current.filter(entry => entry.key !== key));
      for (const slot of ['analysis', 'laboratory'] as const) if (boundRef.current[slot] === key) bind(slot, null);
    },
    discardAll(scope: 'mine' | 'others') {
      const removed = queueRef.current.filter(entry => scope === 'mine' ? entry.owner === user : entry.owner !== user);
      commit(queueRef.current.filter(entry => !removed.includes(entry)));
      for (const slot of ['analysis', 'laboratory'] as const) if (removed.some(entry => entry.key === boundRef.current[slot])) bind(slot, null);
    },
    clearSaved() { commit(queueRef.current.filter(isOpen)); },
    async resolve(key: string, choice: ConflictChoice, copyName: string): Promise<void> {
      const entry = queueRef.current.find(item => item.key === key);
      const remote = entry?.remote, write = entry?.write;
      if (!entry || entry.state !== 'conflict' || !remote || !write) return;
      if (choice === 'theirs') {
        const drafts = boundRef.current.analysis === key;
        value.discard(key);
        // The account version is now the one everything here is bound to, so the next save does not meet a stale version.
        setState(state => state.owner === entry.owner && state.active?.id === remote.id ? { ...state, active: remote } : state);
        setLabBinding(binding => binding?.project.id === remote.id ? { ...binding, project: remote } : binding);
        // The account version replaces the analysis drafts it competed with.
        if (drafts && entry.projectId) await value.open(entry.projectId);
        return;
      }
      const again = { state: 'pending' as const, attempts: 0, retryAt: Date.now(), error: null, remote: null };
      if (choice === 'both') {
        // Yours becomes a new project; the account version stays where it is.
        const requestId = crypto.randomUUID(), name = copyName.slice(0, MAX_PROJECT_NAME_LENGTH);
        patch(key, { ...again, key: newKey(requestId), requestId, projectId: null, base: null, uncertain: false, name, write: { ...write, name } });
        for (const slot of ['analysis', 'laboratory'] as const) if (boundRef.current[slot] === key) bind(slot, newKey(requestId));
      } else patch(key, { ...again, base: remote, write: { ...write, workspace: { ...write.workspace, schemaVersion: workspaceVersion(write.workspace, remote.workspace.schemaVersion) } } });
    },
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
    async saveGeneratorRun(resultJson: string, selection: GeneratorRunSelection | null, target: GeneratorRunTarget): Promise<GeneratorRunSaved | null> {
      const outcome: { value: GeneratorRunSaved | null } = { value: null };
      const done = await run(async (service, signal) => {
        const { addGeneratorRun, createGeneratorRun } = await historyModule();
        const generatorRun: GeneratorRun = await createGeneratorRun(resultJson, { recordedAt: new Date().toISOString(), appBuild: APP_BUILD, selection });
        // Without a connection the search waits and is added to the version in the account when it is sent.
        const targetId = target.kind === 'active' ? current.active?.id ?? null : target.kind === 'project' ? target.id : null;
        const targetName = target.kind === 'active' ? current.active?.name : target.kind === 'project' ? current.items.find(item => item.id === target.id)?.name : target.name.trim();
        const requestId = crypto.randomUUID();
        const wait = (uncertain: boolean, failed?: ApiError): boolean => {
          const base = targetId !== null && targetId === current.active?.id ? current.active : null;
          if (!targetName || !queueChange({ projectId: targetId, base, name: targetName, kind: 'search', run: generatorRun, uncertain, failed: failed?.code }, null, false, requestId)) return false;
          outcome.value = { project: targetName, added: true, queued: true };
          return true;
        };
        if ((entryFor(targetId) || connection === 'offline') && wait(false)) return;
        // Writes the stored project plus the history, never the unsaved drafts of the editor.
        let base: Project | null;
        try { base = target.kind === 'active' ? current.active : target.kind === 'project' ? await service.open(target.id, token, signal) : null; }
        catch (error) { if (!signal.aborted && error instanceof ApiError && isRetryable(error.code) && wait(false, error)) return; throw error; }
        signal.throwIfAborted();
        if (target.kind !== 'new' && !base) throw new ApiError('validation');
        const { history, added } = await addGeneratorRun(base?.workspace.generatorHistory, generatorRun);
        if (base && !added) { outcome.value = { project: base.name, added: false }; return; }
        const workspace = await withGeneratorHistory(base?.workspace ?? EMPTY_WORKSPACE, history);
        const name = base?.name ?? (target.kind === 'new' ? target.name.trim() : '');
        let project: Project;
        try { project = await service.save({ name, activeSequence: base?.activeSequence ?? '', workspace }, token, base ?? undefined, signal, !base && idempotent ? requestId : undefined); }
        catch (error) { if (!signal.aborted && error instanceof ApiError && isRetryable(error.code) && wait(!base, error)) return; throw error; }
        signal.throwIfAborted();
        if (project.workspace.generatorHistory?.documentSha256 !== history.documentSha256) throw new ApiError('invalid-response');
        setState((value) => ({ ...value, active: value.active?.id === project.id ? project : value.active }));
        setLabBinding((binding) => binding?.project.id === project.id ? { ...binding, project } : binding);
        outcome.value = { project: project.name, added: true };
        await relist(service, signal);
      });
      return done ? outcome.value : null;
    },
    removeGeneratorRun(id: string) { return run(async (service, signal) => {
      const base = current.active;
      const history = base?.workspace.generatorHistory;
      if (!base || !history) throw new ApiError('validation');
      const { removeGeneratorRun } = await historyModule();
      const next = await removeGeneratorRun(history, id);
      const workspace = await withGeneratorHistory(base.workspace, next);
      const project = await service.save({ name: base.name, activeSequence: base.activeSequence, workspace }, token, base, signal);
      signal.throwIfAborted();
      if ((project.workspace.generatorHistory?.documentSha256 ?? null) !== (next?.documentSha256 ?? null)) throw new ApiError('invalid-response');
      setState((value) => ({ ...value, active: value.active?.id === project.id ? project : value.active }));
      setLabBinding((binding) => binding?.project.id === project.id ? { ...binding, project } : binding);
      await relist(service, signal);
    }); },
    detach() { if (locked.current) return; if (user) remember(user, null); bind('analysis', null); setState((value) => ({ ...value, active: null, error: null, notice: null })); },
  };
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

