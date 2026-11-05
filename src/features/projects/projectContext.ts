import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { ApiError } from '../api/apiClient';
import type { DescriptorState } from '../descriptors/useDescriptors';
import type { Project, ProjectSummary } from './contracts';
import type { GeneratorRunSelection } from '../generator/history';
import type { ProjectQuery } from './config';
import type { ConflictChoice, SyncEntry } from './syncQueue';

/** Where a generator search is saved: the project open in Analyze, another saved project, or a new one. */
export type GeneratorRunTarget = { kind: 'active' } | { kind: 'project'; id: string } | { kind: 'new'; name: string };
/** `queued`: no connection, the search waits in this tab and is added when it returns. */
export interface GeneratorRunSaved { project: string; added: boolean; queued?: boolean }
export interface ProjectContextValue {
  enabled: boolean;
  active: Project | null;
  laboratory: Project | null;
  items: ProjectSummary[];
  nextPageToken: string | null;
  dirty: boolean;
  busy: boolean;
  error: ApiError | null;
  notice: 'saved' | 'opened' | 'deleted' | 'duplicated' | null;
  /** Counts the actions started, so feedback can tell an earlier success from a new one. */
  attempt: number;
  listing: ProjectQuery;
  /** Whether the API answers; `navigator.onLine` alone only says that some network exists. */
  connection: 'online' | 'offline';
  /** Saves waiting in this tab (every account), oldest first; saved ones stay until cleared. */
  pending: readonly SyncEntry[];
  syncing: boolean;
  /** The waiting saves fed by the Analyze/Compare drafts and by the laboratory. */
  queuedAnalysis: SyncEntry | null;
  queuedLaboratory: SyncEntry | null;
  retry(key: string): void;
  discard(key: string): void;
  /** `mine`: this account's waiting saves, before a deliberate sign-out; `others`: those of another account. */
  discardAll(scope: 'mine' | 'others'): void;
  clearSaved(): void;
  /** Settles a conflict: keep both (`copyName` names yours), yours over the account's, or the account's. */
  resolve(key: string, choice: ConflictChoice, copyName: string): Promise<void>;
  refresh(more?: boolean, query?: ProjectQuery): Promise<boolean>;
  open(id: string, destination?: 'laboratory'): Promise<Project | null>;
  saveLaboratory(name: string, copy?: boolean): Promise<boolean>;
  save(name: string, descriptors?: DescriptorState, copy?: boolean): Promise<boolean>;
  rename(project: ProjectSummary, name: string): Promise<boolean>;
  duplicate(project: ProjectSummary, name: string): Promise<boolean>;
  remove(project: ProjectSummary): Promise<boolean>;
  /** Adds the exact exported search to the project's history; the analysis, comparison and laboratory stay as stored. */
  saveGeneratorRun(resultJson: string, selection: GeneratorRunSelection | null, target: GeneratorRunTarget): Promise<GeneratorRunSaved | null>;
  /** Design's destination for searches: the project open in Analyze until another one (or none) is chosen in Design. */
  searchProject: Project | null;
  /** Chooses Design's destination without opening it in Analyze; `null` keeps searches out of any project. */
  chooseSearchProject(id: string | null): Promise<boolean>;
  /** Creates an empty project and makes it Design's destination. */
  createSearchProject(name: string): Promise<boolean>;
  /** Removes one run from the history of Design's destination project. */
  removeGeneratorRun(id: string): Promise<boolean>;
  detach(): void;
}
export const ProjectContext = createContext<ProjectContextValue | null>(null);
export function useProjects(): ProjectContextValue { return useRequiredContext(ProjectContext, 'ProjectProvider'); }
