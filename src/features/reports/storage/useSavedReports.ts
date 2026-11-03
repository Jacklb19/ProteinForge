import { useContext, useEffect, useSyncExternalStore } from 'react';
import { readApiBaseUrl } from '../../api/config';
import { AuthContext } from '../../auth/authContext';
import { REPORT_STORAGE_LIMITS } from './config';
import type { ReportStorageClient, StoredReport } from './reportStorageClient';
import { failureReason } from './reportStorageErrors';
import { readReportStorageEnabled } from './reportStorageFeature';

/** `unsupported`: the API answered that it cannot store reports, so this build offers nothing. */
export type SavedReportsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
/** `loaded`: the list was read at least once for this owner and is kept while it is read again. */
interface SavedReportsState { owner: string | null; status: SavedReportsStatus; loaded: boolean; reports: readonly StoredReport[] }

const IDLE: SavedReportsState = { owner: null, status: 'idle', loaded: false, reports: [] };
let state = IDLE;
let loading: AbortController | null = null;
/** Saves and removals made while a list is on its way; that answer may predate them. */
let changes: { added: StoredReport[]; dropped: Set<string> } = { added: [], dropped: new Set() };
let client: Promise<ReportStorageClient> | null = null;
const listeners = new Set<() => void>();

function publish(next: SavedReportsState): void {
  state = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * The API client, loaded on first use: the service transport and generated contracts stay out of a
 * visit until a signed-in owner reads or saves reports. `null` when this build has no API address.
 */
export async function reportStorage(): Promise<ReportStorageClient | null> {
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) return null;
  client ??= import('./reportStorageClient').then((module) => module.createReportStorageClient(baseUrl));
  return client;
}

/**
 * One list per account: the owner can hold at most 20 reports, so a single page serves the Export
 * menu (usage and quota) and Projects (rows grouped by project) alike.
 */
export function loadSavedReports(owner: string, token: string, force = false): Promise<readonly StoredReport[] | null> {
  if (!readApiBaseUrl() || (!force && state.owner === owner && state.status !== 'idle')) return Promise.resolve(null);
  loading?.abort();
  const operation = new AbortController();
  loading = operation;
  changes = { added: [], dropped: new Set() };
  const same = state.owner === owner;
  publish({ owner, status: 'loading', loaded: same && state.loaded, reports: same ? state.reports : [] });
  return reportStorage()
    // A load replaced or forgotten while the client was arriving sends nothing.
    .then((api) => { if (!api || operation.signal.aborted) throw new Error('No list to read'); return api.list(token, operation.signal); })
    .then((listed) => {
      if (loading !== operation) return null;
      const added = new Map(changes.added.map((report) => [report.id, report]));
      const reports = [...added.values(), ...listed.filter((report) => !added.has(report.id) && !changes.dropped.has(report.id))];
      publish({ owner, status: 'ready', loaded: true, reports });
      return reports;
    })
    .catch((error: unknown) => {
      if (loading !== operation) return null;
      publish({ owner, status: failureReason(error) === 'unsupported' ? 'unsupported' : 'error', loaded: false, reports: [] });
      return null;
    })
    .finally(() => { if (loading === operation) loading = null; });
}

/** A report this browser just stored, newest first, without asking for the list again. */
export function addSavedReport(owner: string, report: StoredReport): void {
  if (state.owner !== owner) return;
  if (loading) changes.added.push(report);
  publish({ ...state, reports: [report, ...state.reports.filter((item) => item.id !== report.id)] });
}

export function dropSavedReport(owner: string, id: string): void {
  if (state.owner !== owner) return;
  if (loading) changes.dropped.add(id);
  publish({ ...state, reports: state.reports.filter((item) => item.id !== id) });
}

/** Leaves no list behind when the account changes or signs out. */
export function forgetSavedReports(): void {
  loading?.abort();
  loading = null;
  publish(IDLE);
}

export interface ReportUsage { count: number; bytes: number }
export function reportUsage(reports: readonly StoredReport[]): ReportUsage {
  return { count: reports.length, bytes: reports.reduce((total, report) => total + report.sizeBytes, 0) };
}

/** Which limit a new file of this size would cross, pending reservations included as the server counts them. */
export function quotaReason(reports: readonly StoredReport[], sizeBytes: number): 'count' | 'bytes' | null {
  const usage = reportUsage(reports);
  if (usage.count >= REPORT_STORAGE_LIMITS.maxReports) return 'count';
  return usage.bytes + sizeBytes > REPORT_STORAGE_LIMITS.maxOwnerBytes ? 'bytes' : null;
}

/** Saved reports grouped by project id; the empty key holds the ones without a project. */
export function groupByProject(reports: readonly StoredReport[]): Map<string, StoredReport[]> {
  const groups = new Map<string, StoredReport[]>();
  for (const report of reports) groups.set(report.projectId, [...groups.get(report.projectId) ?? [], report]);
  return groups;
}

/**
 * hidden: not offered in this build, without identity, without report storage or before the list has
 * answered (nothing appears and then vanishes); signed-out: invite to sign in, without asking the API.
 */
export type ReportStorageMode = 'hidden' | 'signed-out' | 'ready';

/** `load`: ask for the list now; the Export menu waits until it is first opened, Projects asks at once. */
export function useSavedReports(load = true) {
  // Optional context: a screen rendered without sessions simply does not offer saving.
  const auth = useContext(AuthContext);
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const enabled = readReportStorageEnabled() && readApiBaseUrl() !== null;
  const owner = auth?.status === 'signed-in' ? auth.session?.user.id ?? null : null;
  const token = auth?.session?.accessToken ?? '';
  useEffect(() => {
    if (!enabled) return;
    if (owner && load) void loadSavedReports(owner, token);
    else if (auth?.status === 'anonymous') forgetSavedReports();
  }, [enabled, owner, token, load, auth?.status]);
  const mine = owner && snapshot.owner === owner ? snapshot : IDLE;
  const known = mine.loaded || mine.status === 'error';
  const mode: ReportStorageMode = !enabled || !auth ? 'hidden'
    : auth.status === 'anonymous' ? 'signed-out' : auth.status === 'signed-in' && known ? 'ready' : 'hidden';
  return {
    mode, owner, token, status: mine.status, loaded: mine.loaded, reports: mine.reports, usage: reportUsage(mine.reports),
    refresh: () => { if (owner) void loadSavedReports(owner, token, true); },
  };
}
export type SavedReports = ReturnType<typeof useSavedReports>;
