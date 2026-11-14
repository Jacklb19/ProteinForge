import { ApiError } from '../api/errors';
import { APP_BUILD } from '../generator/appBuild';
import type { GeneratorRun, GeneratorRunSelection } from '../generator/history';
import type { Project } from './contracts';
import { MAX_PROJECT_NAME_LENGTH } from './config';
import type { GeneratorRunSaved, GeneratorRunTarget } from './projectContext';
import { withGeneratorHistory } from './snapshot';
import { isRetryable } from './syncQueue';
import type { SyncQueue } from './useSyncQueue';
import { EMPTY_WORKSPACE, historyModule, written } from './projectState';
import type { ProjectCore, Relist, Run, State } from './projectState';

/**
 * Design's destination: the project whose saved searches it shows and saves to. It follows the project open
 * in Analyze until one is chosen in Design, and a search is written into the stored project, never the drafts.
 */
export function useDesignTarget(core: ProjectCore, current: State, run: Run, relist: Relist, sync: SyncQueue, follow: (project: Project) => void) {
  const { token, idempotent, setState } = core;
  const { queueChange, entryFor, connection } = sync;
  // The copy in `active` is fresher when both are the same project.
  const searchProject = current.searchFollows ? current.active
    : current.searchProject && current.active?.id === current.searchProject.id ? current.active : current.searchProject;
  return {
    searchProject,
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
        setState(written(project));
        follow(project);
        outcome.value = { project: project.name, added: true };
        await relist(service, signal);
      });
      return done ? outcome.value : null;
    },
    chooseSearchProject(id: string | null) { return run(async (service, signal) => {
      if (id === null) { setState(value => ({ ...value, searchFollows: false, searchProject: null })); return; }
      // Choosing here reads the stored project; it neither opens it in Analyze nor touches the drafts.
      const project = current.active?.id === id ? current.active : await service.open(id, token, signal);
      if (signal.aborted) return;
      setState(value => ({ ...value, searchFollows: false, searchProject: project }));
    }); },
    createSearchProject(name: string) { return run(async (service, signal) => {
      // A project for searches starts empty: it does not take the sequence or comparison from Analyze.
      const project = await service.save({ name: name.trim().slice(0, MAX_PROJECT_NAME_LENGTH), activeSequence: '', workspace: EMPTY_WORKSPACE }, token, undefined, signal, idempotent ? crypto.randomUUID() : undefined);
      if (signal.aborted) return;
      setState(value => ({ ...value, searchFollows: false, searchProject: project }));
      await relist(service, signal);
    }); },
    removeGeneratorRun(id: string) { return run(async (service, signal) => {
      const base = searchProject;
      const history = base?.workspace.generatorHistory;
      if (!base || !history) throw new ApiError('validation');
      const { removeGeneratorRun } = await historyModule();
      const next = await removeGeneratorRun(history, id);
      const workspace = await withGeneratorHistory(base.workspace, next);
      const project = await service.save({ name: base.name, activeSequence: base.activeSequence, workspace }, token, base, signal);
      signal.throwIfAborted();
      if ((project.workspace.generatorHistory?.documentSha256 ?? null) !== (next?.documentSha256 ?? null)) throw new ApiError('invalid-response');
      setState(written(project));
      follow(project);
      await relist(service, signal);
    }); },
  };
}
