import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { ApiError } from '../api/apiClient';
import type { DescriptorState } from '../descriptors/useDescriptors';
import type { Project, ProjectSummary } from './contracts';
import type { GeneratorRunSelection } from '../generator/history';
import type { ProjectQuery } from './config';

/** Where a generator search is saved: the project open in Analyze, another saved project, or a new one. */
export type GeneratorRunTarget = { kind: 'active' } | { kind: 'project'; id: string } | { kind: 'new'; name: string };
export interface GeneratorRunSaved { project: string; added: boolean }
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
  refresh(more?: boolean, query?: ProjectQuery): Promise<boolean>;
  open(id: string, destination?: 'laboratory'): Promise<Project | null>;
  saveLaboratory(name: string, copy?: boolean): Promise<boolean>;
  save(name: string, descriptors?: DescriptorState, copy?: boolean): Promise<boolean>;
  rename(project: ProjectSummary, name: string): Promise<boolean>;
  duplicate(project: ProjectSummary, name: string): Promise<boolean>;
  remove(project: ProjectSummary): Promise<boolean>;
  /** Adds the exact exported search to the project's history; the analysis, comparison and laboratory stay as stored. */
  saveGeneratorRun(resultJson: string, selection: GeneratorRunSelection | null, target: GeneratorRunTarget): Promise<GeneratorRunSaved | null>;
  /** Removes one run from the history of the project open in Analyze. */
  removeGeneratorRun(id: string): Promise<boolean>;
  detach(): void;
}
export const ProjectContext = createContext<ProjectContextValue | null>(null);
export function useProjects(): ProjectContextValue { return useRequiredContext(ProjectContext, 'ProjectProvider'); }
