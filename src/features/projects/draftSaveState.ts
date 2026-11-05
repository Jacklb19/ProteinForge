import { useContext } from 'react';
import { ProjectContext } from './projectContext';
import { useRelativeTime } from './syncSummary';

/** example: the bundled content untouched; unsaved: own content outside any project; saved / changed: against a project. */
export type SaveStateKind = 'example' | 'unsaved' | 'saved' | 'changed';
export interface SaveStateValue { kind: SaveStateKind; project?: string; detail?: string | null }

/** The state of the Analyze and Compare drafts against the project open in them. */
export function useDraftSaveState(isExample: boolean): SaveStateValue {
  const projects = useContext(ProjectContext);
  const relative = useRelativeTime();
  const active = projects?.active;
  if (active) return projects.dirty ? { kind: 'changed', project: active.name } : { kind: 'saved', project: active.name, detail: relative(active.updatedAt) };
  return { kind: isExample ? 'example' : 'unsaved' };
}
