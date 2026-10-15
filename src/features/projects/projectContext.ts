import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { ApiError } from '../api/apiClient';
import type { DescriptorState } from '../descriptors/useDescriptors';
import type { Project, ProjectSummary } from './contracts';

export interface ProjectContextValue {
  enabled: boolean;
  active: Project | null;
  items: ProjectSummary[];
  nextPageToken: string | null;
  dirty: boolean;
  busy: boolean;
  error: ApiError | null;
  notice: 'saved' | 'opened' | 'deleted' | null;
  refresh(more?: boolean): Promise<boolean>;
  open(id: string): Promise<boolean>;
  save(name: string, descriptors?: DescriptorState, copy?: boolean): Promise<boolean>;
  rename(project: ProjectSummary, name: string): Promise<boolean>;
  remove(project: ProjectSummary): Promise<boolean>;
  detach(): void;
}
export const ProjectContext = createContext<ProjectContextValue | null>(null);
export function useProjects(): ProjectContextValue { return useRequiredContext(ProjectContext, 'ProjectProvider'); }
