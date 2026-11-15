import type { Dispatch, SetStateAction } from 'react';
import { DEFAULT_EXAMPLE } from '../editor/examples';
import { EXAMPLE_ALIGNMENT_INPUT } from '../alignment/examples';
import type { ApiError } from '../api/errors';
import type { SequenceDraft } from '../editor/sequenceDraft';
import type { AlignmentDraft } from '../alignment/alignmentDraft';
import { DEFAULT_MATRIX, DEFAULT_MODE } from '../alignment/config';
import { DEFAULT_HYDROPATHY_WINDOW } from '../descriptors/config';
import type { ProjectApi } from './projectApi';
import type { Project, ProjectSummary, WorkspaceSnapshot } from './contracts';
import { DEFAULT_PROJECT_QUERY, PROJECT_POINTER_PREFIX } from './config';
import type { ProjectQuery } from './config';

export interface State {
  owner: string | null; active: Project | null; items: ProjectSummary[]; nextPageToken: string | null; listing: ProjectQuery; busy: boolean; error: ApiError | null; notice: 'saved' | 'opened' | 'deleted' | 'duplicated' | 'restored' | null; attempt: number;
  /** Design's own destination for searches: it follows the project open in Analyze until a project is chosen there. */
  searchFollows: boolean; searchProject: Project | null;
}
/** A project created only to keep generator searches starts without analysis or comparison. */
export const EMPTY_WORKSPACE: WorkspaceSnapshot = { schemaVersion: 1, profileWindow: DEFAULT_HYDROPATHY_WINDOW, source: null, descriptors: null, alignment: { first: '', second: '', matrix: DEFAULT_MATRIX, mode: DEFAULT_MODE, result: null } };
export const EMPTY: State = { owner: null, active: null, items: [], nextPageToken: null, listing: DEFAULT_PROJECT_QUERY, busy: false, error: null, notice: null, attempt: 0, searchFollows: true, searchProject: null };

/**
 * The single lock every action takes, the generation that tells a replaced action apart, the abort
 * controller of the one running and the revision that changes with the signed-in owner. One instance per
 * provider, changed only through these methods.
 */
export class ActionGate {
  private held = false;
  private generation = 0;
  private ownerRevision = 0;
  private running: AbortController | null = null;
  get locked(): boolean { return this.held; }
  lock(held = true): void { this.held = held; }
  get epoch(): number { return this.generation; }
  /** Starts a new generation; whatever belongs to an earlier one no longer applies its result. */
  advance(): number { return ++this.generation; }
  get owner(): number { return this.ownerRevision; }
  changeOwner(): void { this.ownerRevision++; }
  /** Aborts the running action, if any, and makes this operation the running one. */
  replace(operation: AbortController): void { this.running?.abort(); this.running = operation; }
  /** Makes this operation the running one without aborting the previous. */
  adopt(operation: AbortController): void { this.running = operation; }
}

/** What the provider's hooks share: who is signed in, the service and the gate every action passes. */
export interface ProjectCore {
  user: string | null; email: string; token: string; enabled: boolean; idempotent: boolean;
  client: ProjectApi | null; serviceClient: () => Promise<ProjectApi | null>;
  gate: ActionGate;
  setState: Dispatch<SetStateAction<State>>;
}
/** Runs a task under the lock; resolves true when it completed for the same owner and was not replaced. */
export type Run = (task: (client: ProjectApi, signal: AbortSignal) => Promise<void>) => Promise<boolean>;
export type Relist = (service: ProjectApi, signal: AbortSignal) => Promise<void>;

/**
 * The generator history is written in zod and is only read when a search result is stored or
 * removed, never while rendering, so it arrives with that action. Together with the project
 * contracts this keeps zod out of the initial download; see `docs/performance-2026-10-27.md`.
 */
let loadingHistory: Promise<typeof import('../generator/history')> | null = null;
export const historyModule = (): Promise<typeof import('../generator/history')> => (loadingHistory ??= import('../generator/history'));

export function remember(owner: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(`${PROJECT_POINTER_PREFIX}${owner}`, id);
    else localStorage.removeItem(`${PROJECT_POINTER_PREFIX}${owner}`);
  } catch { /* Private contexts may disable storage; server persistence still works. */ }
}
/** True while both drafts are empty or still hold the examples the application opens with. */
export function untouchedDrafts(sequence: SequenceDraft, alignment: AlignmentDraft): boolean {
  const sequenceUntouched = (!sequence.text || sequence.text === DEFAULT_EXAMPLE.text)
    && sequence.profileWindow === DEFAULT_HYDROPATHY_WINDOW
    && (!sequence.source || sequence.source === DEFAULT_EXAMPLE.source);
  const alignmentUntouched = ((!alignment.first && !alignment.second)
    || (alignment.first === EXAMPLE_ALIGNMENT_INPUT.first && alignment.second === EXAMPLE_ALIGNMENT_INPUT.second))
    && alignment.matrix === DEFAULT_MATRIX && alignment.mode === DEFAULT_MODE;
  return sequenceUntouched && alignmentUntouched;
}
export function lastProject(owner: string): string | null {
  try { const id = localStorage.getItem(`${PROJECT_POINTER_PREFIX}${owner}`); return id && /^[a-f0-9-]{36}$/i.test(id) ? id : null; } catch { return null; }
}
/** Keeps the stored copies of a project that was just written in step, wherever this screen holds them. */
export const written = (project: Project) => (value: State): State => ({
  ...value, active: value.active?.id === project.id ? project : value.active, searchProject: value.searchProject?.id === project.id ? project : value.searchProject,
});
