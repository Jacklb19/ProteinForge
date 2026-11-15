import { ApiError } from '../api/errors';
import type { ProjectApi } from './projectApi';
import type { Project, ProjectWrite } from './contracts';
import { withGeneratorHistory } from './snapshot';
import { afterFailure, sameContent } from './syncQueue';
import type { SyncEntry } from './syncQueue';
import { EMPTY_WORKSPACE, historyModule } from './projectState';

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
export async function send(service: ProjectApi, entry: SyncEntry, signal: AbortSignal, token: string, idempotent: boolean): Promise<Partial<SyncEntry>> {
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
