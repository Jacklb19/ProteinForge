import type { ApiErrorCode } from '../api/errors';
import type { GeneratorRun } from '../generator/history';
import { PROJECT_PREVIEW_RESIDUES, SYNC_MAX_ENTRIES, SYNC_RETRYABLE_ERRORS, SYNC_RETRY_DELAYS_MS } from './config';
import type { Project, ProjectSummary, ProjectWrite } from './contracts';

/**
 * Saves that wait for the connection (RF-15, proposal A). The queue lives only in this tab's memory,
 * never in browser storage: closing or reloading the tab loses it, and the page warns before that.
 * One entry per project; a second save of the same project replaces the content of the first.
 */
export type SyncKind = 'analysis' | 'laboratory' | 'search';
export type SyncState = 'pending' | 'saving' | 'saved' | 'conflict' | 'failed';
export type ConflictChoice = 'both' | 'mine' | 'theirs';

export interface SyncEntry {
  /** The project id, or `new:` and the request id while the project does not exist yet. */
  key: string;
  owner: string;
  email: string;
  projectId: string | null;
  /** Sent with a create so that repeating it returns the project already created. */
  requestId: string;
  name: string;
  /** The latest change, for the row text. */
  kind: SyncKind;
  /** The stored version the write started from; a different one in the account is a conflict. */
  base: Project | null;
  /** Analysis or laboratory content. Searches alone carry no write: they are added to the version read when sending. */
  write: ProjectWrite | null;
  runs: GeneratorRun[];
  changedAt: number;
  state: SyncState;
  attempts: number;
  retryAt: number;
  error: ApiErrorCode | null;
  /** A create whose earlier attempt may have reached the server. */
  uncertain: boolean;
  remote: Project | null;
  saved: Project | null;
  savedAt: number | null;
  /** Laboratory drafts to mark as saved once the write lands. */
  laboratory: { revision: number; fingerprint: string; variants: number } | null;
}

export type SyncChange = Pick<SyncEntry, 'owner' | 'email' | 'name' | 'kind'> & {
  projectId: string | null;
  base: Project | null;
  write?: ProjectWrite | null;
  run?: GeneratorRun;
  laboratory?: SyncEntry['laboratory'];
  uncertain: boolean;
  /** The request that just failed with this code counts as the first attempt: the next one waits. */
  failed?: ApiErrorCode;
};

export const newKey = (requestId: string): string => `new:${requestId}`;
export const isOpen = (entry: SyncEntry): boolean => entry.state !== 'saved';
export const needsAttention = (entry: SyncEntry): boolean => entry.state === 'conflict' || entry.state === 'failed';
export const isRetryable = (code: ApiErrorCode): boolean => SYNC_RETRYABLE_ERRORS.includes(code);

/** Adds a change, or merges it into the open entry it belongs to; saved entries make room first. */
export function enqueue(entries: readonly SyncEntry[], change: SyncChange, now: number, key: string | null, requestId: string): { entries: SyncEntry[]; key: string } | null {
  // Another account's entry is never merged into, not even through a bound key left from its session.
  const target = entries.find(entry => isOpen(entry) && entry.owner === change.owner && (key ? entry.key === key : change.projectId !== null && entry.projectId === change.projectId));
  const kept = entries.filter(entry => entry.state !== 'saved' || entry === target);
  if (target) {
    const runs = change.run && !target.runs.some(run => run.id === change.run?.id) ? [...target.runs, change.run] : target.runs;
    const merged: SyncEntry = {
      // A search alone carries no base; a later analysis or laboratory save brings the version it started from.
      ...target, name: change.name, kind: change.kind, write: change.write === undefined ? target.write : change.write, runs, base: target.base ?? change.base,
      laboratory: change.laboratory === undefined ? target.laboratory : change.laboratory, changedAt: now,
      state: 'pending', attempts: 0, retryAt: now, error: null, remote: null, uncertain: target.uncertain || change.uncertain,
    };
    return { entries: kept.map(entry => entry === target ? merged : entry), key: target.key };
  }
  if (kept.filter(isOpen).length >= SYNC_MAX_ENTRIES) return null;
  const tried = change.failed ? { attempts: 1, retryAt: now + SYNC_RETRY_DELAYS_MS[0], error: change.failed } : { attempts: 0, retryAt: now, error: null };
  const created: SyncEntry = {
    key: change.projectId ?? newKey(requestId), owner: change.owner, email: change.email, projectId: change.projectId, requestId,
    name: change.name, kind: change.kind, base: change.base, write: change.write ?? null, runs: change.run ? [change.run] : [],
    changedAt: now, state: 'pending', ...tried, uncertain: change.uncertain, remote: null,
    saved: null, savedAt: null, laboratory: change.laboratory ?? null,
  };
  return { entries: [...kept, created], key: created.key };
}

/** After a failed attempt: wait and try again, or stop and leave the choice to the person. */
export function afterFailure(entry: SyncEntry, code: ApiErrorCode, now: number, canRepeat: boolean): SyncEntry {
  const attempts = entry.attempts + 1;
  const delay: number | undefined = SYNC_RETRY_DELAYS_MS[attempts - 1];
  if (isRetryable(code) && canRepeat && delay !== undefined) return { ...entry, state: 'pending', attempts, error: code, retryAt: now + delay };
  return { ...entry, state: 'failed', attempts, error: code };
}

/** The entries of this owner that may be sent now, oldest first. */
export function due(entries: readonly SyncEntry[], owner: string, now: number): SyncEntry[] {
  return entries.filter(entry => entry.owner === owner && entry.state === 'pending' && entry.retryAt <= now);
}

/** The next moment a waiting entry of this owner becomes due, if any. */
export function nextRetry(entries: readonly SyncEntry[], owner: string, now: number): number | null {
  const later = entries.filter(entry => entry.owner === owner && entry.state === 'pending' && entry.retryAt > now).map(entry => entry.retryAt);
  return later.length ? Math.min(...later) : null;
}

/** JSON with sorted keys, where an absent field and null are the same; documents are compared by their hashes. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.entries(value).filter(([, item]) => item !== null && item !== undefined).sort(([a], [b]) => a < b ? -1 : 1);
    return `{${fields.map(([name, item]) => `${JSON.stringify(name)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * A lost response leaves the write stored although it failed here; the retry then meets its own result
 * as a "conflict". The stored version is ours only when every part the client writes is the same:
 * name, sequence and the whole workspace (source, descriptors, comparison and its result, laboratory and searches).
 */
export function sameContent(stored: Pick<Project, 'name' | 'activeSequence' | 'workspace'>, write: ProjectWrite): boolean {
  const key = (value: Pick<Project, 'name' | 'activeSequence' | 'workspace'>): string => {
    const { laboratory, generatorHistory, ...workspace } = value.workspace;
    return canonical([value.name, value.activeSequence, workspace, laboratory?.documentSha256, generatorHistory?.documentSha256]);
  };
  return key(stored) === key(write);
}

/** A row for a project that exists only in this queue, with the compact evidence of what will be saved. */
export function pendingSummary(entry: SyncEntry): ProjectSummary {
  const changed = new Date(entry.changedAt).toISOString();
  const write = entry.write;
  if (!write) return { id: entry.key, name: entry.name, status: 'draft', createdAt: changed, updatedAt: changed, preview: null };
  const sequence = write.activeSequence, workspace = write.workspace, alignment = workspace.alignment;
  const prefix = (value: string): string => value.slice(0, PROJECT_PREVIEW_RESIDUES);
  return {
    id: entry.key, name: entry.name, status: 'draft', createdAt: changed, updatedAt: changed,
    preview: {
      hasLaboratory: Boolean(workspace.laboratory), laboratoryVariants: entry.laboratory?.variants ?? 0, generatorRuns: entry.runs.length,
      sequenceLength: sequence.length, sequencePrefix: prefix(sequence), excluded: sequence.match(/[UOBZX]/g)?.length ?? 0,
      descriptors: workspace.descriptors?.result ?? null, source: workspace.source ? { origin: workspace.source.origin, accession: workspace.source.accession } : null,
      alignment: alignment.first || alignment.second ? {
        firstLength: alignment.first.length, secondLength: alignment.second.length, firstPrefix: prefix(alignment.first), secondPrefix: prefix(alignment.second),
        matrix: alignment.matrix, mode: alignment.mode,
        result: alignment.result ? { identities: alignment.result.identities, similarities: alignment.result.similarities, columns: alignment.result.columns } : null,
      } : null,
    },
  };
}

/** Variants in a stored laboratory document, for comparing two versions; zero when it cannot be read. */
export function laboratoryVariants(project: Pick<Project, 'workspace'>): number {
  try {
    const document: unknown = JSON.parse(project.workspace.laboratory?.documentJson ?? 'null');
    const drafts: unknown = typeof document === 'object' && document !== null && 'state' in document && typeof document.state === 'object' && document.state !== null && 'drafts' in document.state ? document.state.drafts : null;
    return typeof drafts === 'object' && drafts !== null ? Object.keys(drafts).length : 0;
  } catch { return 0; }
}
