import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/errors';
import type { ProjectApi } from './projectApi';
import type { Project } from './contracts';
import { MAX_PROJECT_NAME_LENGTH } from './config';
import { workspaceVersion } from './snapshot';
import { due, enqueue, isOpen, newKey, nextRetry } from './syncQueue';
import type { ConflictChoice, SyncChange, SyncEntry } from './syncQueue';
import { send } from './syncSend';
import type { ProjectCore, Relist } from './projectState';

type Slot = 'analysis' | 'laboratory';

/**
 * Saves waiting for the connection (RF-15): tab memory only, kept across a session that ends while offline.
 * Also owns what the tab knows about the connection, since every answer from the API wakes the queue.
 */
export function useSyncQueue(core: ProjectCore) {
  const { user, email, setState } = core;
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
  const poke = useCallback(() => { setWake(value => value + 1); }, []);
  const connection = online && !unreachable ? 'online' as const : 'offline' as const;
  const commit = useCallback((next: SyncEntry[]) => { queueRef.current = next; setQueue(next); }, []);
  const patch = useCallback((key: string, changes: Partial<SyncEntry>) => { commit(queueRef.current.map(entry => entry.key === key ? { ...entry, ...changes } : entry)); }, [commit]);
  const bind = useCallback((slot: Slot, key: string | null) => {
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
    const up = (): void => { setOnline(true); setUnreachable(false); poke(); };
    const down = (): void => { setOnline(false); };
    const visible = (): void => { if (document.visibilityState === 'visible') poke(); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); document.removeEventListener('visibilitychange', visible); };
  }, [poke]);
  // Every answer from the API wakes the queue; a failed fetch marks the API unreachable.
  const watched = useCallback((service: ProjectApi): ProjectApi => {
    const observe = <T,>(request: Promise<T>): Promise<T> => request.then(
      (result) => { setUnreachable(false); setWake(value => value + 1); return result; },
      (error: unknown) => { if (error instanceof ApiError && error.code === 'network') setUnreachable(true); throw error; },
    );
    return {
      list: (...args) => observe(service.list(...args)), open: (...args) => observe(service.open(...args)),
      save: (...args) => observe(service.save(...args)), remove: (...args) => observe(service.remove(...args)),
      ...(service.versions ? { versions: (...args: Parameters<NonNullable<ProjectApi['versions']>>) => observe(service.versions?.(...args) ?? Promise.reject(new ApiError('unavailable'))) } : {}),
      ...(service.restore ? { restore: (...args: Parameters<NonNullable<ProjectApi['restore']>>) => observe(service.restore?.(...args) ?? Promise.reject(new ApiError('unavailable'))) } : {}),
    };
  }, []);
  /** Queues a change when it cannot be sent now; returns false when the queue is full. */
  function queueChange(change: Omit<SyncChange, 'owner' | 'email'>, slot: Slot | null, copy: boolean, requestId: string = crypto.randomUUID()): boolean {
    if (!user) return false;
    const result = enqueue(queueRef.current, { ...change, owner: user, email }, Date.now(), slot && !copy ? boundRef.current[slot] : null, requestId);
    if (!result) return false;
    commit(result.entries);
    if (slot) bind(slot, result.key);
    setState(value => ({ ...value, owner: user, notice: null, error: null }));
    poke();
    return true;
  }
  function retry(key: string): void {
    const entry = queueRef.current.find(item => item.key === key);
    if (!entry || entry.state !== 'failed') return;
    // The person asked again: a create that may exist is repeated once; a project deleted meanwhile is created anew.
    const gone = entry.error === 'not-found';
    patch(key, { state: 'pending', attempts: 0, retryAt: Date.now(), error: null, uncertain: false, ...(gone ? { projectId: null, base: null } : {}) });
  }
  function discard(key: string): void {
    commit(queueRef.current.filter(entry => entry.key !== key));
    for (const slot of ['analysis', 'laboratory'] as const) if (boundRef.current[slot] === key) bind(slot, null);
  }
  function discardAll(scope: 'mine' | 'others'): void {
    const removed = queueRef.current.filter(entry => scope === 'mine' ? entry.owner === user : entry.owner !== user);
    commit(queueRef.current.filter(entry => !removed.includes(entry)));
    for (const slot of ['analysis', 'laboratory'] as const) if (removed.some(entry => entry.key === boundRef.current[slot])) bind(slot, null);
  }
  function clearSaved(): void { commit(queueRef.current.filter(isOpen)); }
  /** `open` reads the account version into the drafts; `follow` keeps the laboratory bound to it. */
  async function resolve(key: string, choice: ConflictChoice, copyName: string, open: (id: string) => Promise<unknown>, follow: (project: Project) => void): Promise<void> {
    const entry = queueRef.current.find(item => item.key === key);
    const remote = entry?.remote, write = entry?.write;
    if (!entry || entry.state !== 'conflict' || !remote || !write) return;
    if (choice === 'theirs') {
      const drafts = boundRef.current.analysis === key;
      discard(key);
      // The account version is now the one everything here is bound to, so the next save does not meet a stale version.
      setState(state => state.owner === entry.owner && state.active?.id === remote.id ? { ...state, active: remote } : state);
      follow(remote);
      // The account version replaces the analysis drafts it competed with.
      if (drafts && entry.projectId) await open(entry.projectId);
      return;
    }
    const again = { state: 'pending' as const, attempts: 0, retryAt: Date.now(), error: null, remote: null };
    if (choice === 'both') {
      // Yours becomes a new project; the account version stays where it is.
      const requestId = crypto.randomUUID(), name = copyName.slice(0, MAX_PROJECT_NAME_LENGTH);
      patch(key, { ...again, key: newKey(requestId), requestId, projectId: null, base: null, uncertain: false, name, write: { ...write, name } });
      for (const slot of ['analysis', 'laboratory'] as const) if (boundRef.current[slot] === key) bind(slot, newKey(requestId));
    } else patch(key, { ...again, base: remote, write: { ...write, workspace: { ...write.workspace, schemaVersion: workspaceVersion(write.workspace, remote.workspace.schemaVersion) } } });
  }
  const actions = { retry, discard, discardAll, clearSaved, resolve };
  return { queue, queueRef, bound, boundRef, online, syncing, setSyncing, wake, poke, connection, patch, bind, openEntry, shownEntry, entryFor, watched, queueChange, actions };
}

export type SyncQueue = ReturnType<typeof useSyncQueue>;

/**
 * Asks before closing a tab with waiting saves, and sends them when the network returns, the tab becomes
 * visible, the API answers or a retry delay ends, one by one under the same lock as every other action.
 * Called after the initial restore, so that restore takes the lock first in the same commit.
 */
export function useQueueFlush(core: ProjectCore, sync: SyncQueue, expiresAt: number | null, relist: Relist, landed: (entry: SyncEntry, project: Project, owner: string) => void): void {
  const { user, token, enabled, idempotent, client, serviceClient, gate } = core;
  const { queue, queueRef, wake, online, patch, watched, poke, setSyncing } = sync;
  // Waiting saves exist only in this tab, so closing or reloading it asks first (the browser's own prompt).
  const unsent = queue.some(isOpen);
  useEffect(() => {
    if (!unsent) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); };
  }, [unsent]);

  async function flush(): Promise<void> {
    if (!user || gate.locked) return;
    const owner = user, startingOwner = gate.owner;
    gate.lock();
    let service: ProjectApi | null = null;
    try { service = client ?? await serviceClient(); } catch { /* Still unreachable; the next wake tries again. */ }
    if (!service || gate.owner !== startingOwner) { if (gate.owner === startingOwner) gate.lock(false); return; }
    const tracked = watched(service);
    const epoch = gate.advance();
    const operation = new AbortController();
    gate.adopt(operation);
    setSyncing(true);
    let stored = false;
    try {
      for (let entry = due(queueRef.current, owner, Date.now())[0]; entry; entry = due(queueRef.current, owner, Date.now())[0]) {
        patch(entry.key, { state: 'saving' });
        const outcome = await send(tracked, entry, operation.signal, token, idempotent);
        patch(entry.key, outcome);
        if (operation.signal.aborted || gate.epoch !== epoch) break;
        if (outcome.state === 'saved' && outcome.saved) { stored = true; landed(entry, outcome.saved, owner); }
        // Nothing else gets through either; the next wake tries again.
        if (outcome.error === 'network') break;
      }
      if (stored && !operation.signal.aborted && gate.epoch === epoch) await relist(tracked, operation.signal);
    } finally {
      setSyncing(false);
      if (gate.epoch === epoch) { gate.lock(false); poke(); }
    }
  }

  useEffect(() => {
    if (!user || !token || !enabled || !online || gate.locked) return;
    // An expired token waits for the session refresh, which changes the token and wakes this again.
    if (expiresAt !== null && expiresAt * 1_000 <= Date.now()) return;
    const now = Date.now();
    if (due(queue, user, now).length) { void flush(); return; }
    const next = nextRetry(queue, user, now);
    if (next === null) return;
    const timer = window.setTimeout(poke, next - now);
    return () => { window.clearTimeout(timer); };
    // flush reads the latest queue and drafts through refs; these are the moments to look again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, wake, user, token, enabled, online]);
}
