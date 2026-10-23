import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { MAX_PROJECT_NAME_LENGTH } from './config';
import type { ProjectSummary } from './contracts';
import type { ProjectAction, ProjectDestination } from './ProjectCard';
import { useProjects } from './projectContext';
import { ProjectFeedback } from './ProjectControls';

export interface ProjectIntent { action: ProjectAction | 'open'; project: ProjectSummary; destination?: ProjectDestination }
interface Props { intent: ProjectIntent; name: string; setName: (name: string) => void; onClose: () => void; onSubmit: () => void }

/** Native modal focus containment and deliberate confirmation, with request feedback inside. */
export function ProjectDialog({ intent, name, setName, onClose, onSubmit }: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const projects = useProjects();
  const { t } = useTranslation();
  const editsName = intent.action === 'rename' || intent.action === 'duplicate';
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    // Close before React removes the dialog, so native focus restoration still has its source.
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); else document.getElementById('project-search')?.focus(); };
  }, []);
  const confirmKey = intent.action === 'delete' ? 'projects.confirmDelete'
    : intent.action === 'rename' ? 'projects.confirmRename'
    : intent.action === 'duplicate' ? 'projects.confirmDuplicate' : 'projects.confirmOpen';
  return (
    <dialog
      ref={dialog} className="project-dialog" aria-labelledby="project-dialog-title" aria-describedby="project-dialog-name"
      onCancel={event => { event.preventDefault(); if (!projects.busy) onClose(); }}
    >
      <form className="project-confirm" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
        <h2 id="project-dialog-title">{t(`projects.${intent.action}`)}</h2>
        <p id="project-dialog-name" className="project-dialog-name">{intent.project.name}</p>

        {editsName ? (
          <div className="field">
            <label htmlFor="project-dialog-input">{t('projects.name')}</label>
            <input
              autoFocus id="project-dialog-input" className="text-input" value={name}
              onChange={event => { setName(event.target.value); }}
              maxLength={MAX_PROJECT_NAME_LENGTH} required disabled={projects.busy}
            />
          </div>
        ) : <p>{t(intent.action === 'delete' ? 'projects.deleteWarning' : intent.destination === 'laboratory' ? 'lab.reopenWarning' : 'projects.replaceWarning')}</p>}

        <ProjectFeedback />

        <div className="actions">
          {/* Cancel takes the focus when nothing is typed, so a deliberate confirmation needs a move. */}
          <button autoFocus={!editsName} className="button button-secondary" type="button" disabled={projects.busy} onClick={onClose}>
            {t('projects.cancel')}
          </button>
          <button
            className={`button ${intent.action === 'delete' ? 'button-danger' : 'button-primary'}`}
            type="submit" disabled={projects.busy || (editsName && !name.trim())}
          >{t(confirmKey)}</button>
        </div>
      </form>
    </dialog>
  );
}
