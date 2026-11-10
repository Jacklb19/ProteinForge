import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { ApiError } from '../api/apiClient';
import { PROJECT_ERROR_KEYS } from './config';
import type { ProjectSummary, ProjectVersion } from './contracts';
import { useProjects } from './projectContext';

/** What a version holds, in the same words as the card: residues, a comparison or the laboratory. */
function VersionMeta({ version }: { version: ProjectVersion }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const preview = version.preview;
  const parts = !preview ? [] : [
    preview.sequenceLength ? t('fasta.residues', { count: formatNumber(preview.sequenceLength) }) : '',
    preview.alignment ? t('projects.comparisonLengths', { first: formatNumber(preview.alignment.firstLength), second: formatNumber(preview.alignment.secondLength) }) : '',
    preview.hasLaboratory ? t(preview.laboratoryVariants === 1 ? 'lab.projectVariantsOne' : 'lab.projectVariants', { count: preview.laboratoryVariants ?? 0 }) : '',
    preview.generatorRuns ? t(preview.generatorRuns === 1 ? 'projects.generatorRunsOne' : 'projects.generatorRuns', { count: formatNumber(preview.generatorRuns) }) : '',
  ].filter(Boolean);
  return <p className="report-row-meta">{parts.length ? parts.join(' · ') : t('versions.empty')}</p>;
}

/**
 * Inside a project card: its earlier contents, read when the list is opened and again after the project
 * changes. Restoring one keeps what is stored now as a version, so it can be undone from the same list.
 */
export function ProjectVersions({ project, active, dirty, offline }: { project: ProjectSummary; active: boolean; dirty: boolean; offline: boolean }): React.JSX.Element {
  const { t, formatDate } = useTranslation();
  const projects = useProjects();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ for: string; versions: ProjectVersion[] } | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const summary = useRef<HTMLElement>(null);
  // The provider's value changes on every render; the request reads the latest one without being repeated by it.
  const latest = useRef(projects);
  useLayoutEffect(() => { latest.current = projects; });
  // The list belongs to the version of the project it was read for; a newer save reads it again.
  const revision = `${project.id}:${project.updatedAt}`;
  useEffect(() => {
    if (!open || offline || state?.for === revision) return;
    let current = true;
    latest.current.versions(project.id).then(
      (versions) => { if (current) { setState({ for: revision, versions }); setFailure(null); } },
      (error: unknown) => { if (current) setFailure(error as ApiError); },
    );
    return () => { current = false; };
  }, [open, offline, revision, state?.for, project.id]);

  const restore = (version: ProjectVersion): void => {
    void projects.restoreVersion(project, version.id).then((done) => {
      if (!done) return;
      setConfirming(null);
      summary.current?.focus();
    });
  };
  const shown = state?.for === revision ? state.versions : null;
  const date = (value: string): string => formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  return <details className="project-reports project-versions" onToggle={(event) => { setOpen(event.currentTarget.open); }}>
    <summary ref={summary}>{t('versions.title')}</summary>
    {offline ? <p className="field-help">{t('versions.offline')}</p>
      : failure ? <p className="status-message" data-state="error" role="alert">{t(PROJECT_ERROR_KEYS[failure.code])}</p>
        : !shown ? <p className="status-message" role="status">{t('versions.loading')}</p>
          : !shown.length ? <p className="field-help">{t('versions.none')}</p>
            : <ul className="report-list" aria-label={t('versions.listOf', { project: project.name })}>
              {shown.map((version) => <li key={version.id} className="report-row">
                <div className="report-row-text">
                  <p className="report-row-title"><time dateTime={version.savedAt}>{t('versions.savedAt', { date: date(version.savedAt) })}</time></p>
                  <VersionMeta version={version} />
                </div>
                {confirming === version.id ? <div className="project-confirm" role="group" aria-labelledby={titleId}
                  onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setConfirming(null); } }}>
                  <h3 id={titleId}>{t('versions.confirmTitle', { date: date(version.savedAt) })}</h3>
                  <p className="field-help">{t('versions.confirmHelp')}</p>
                  {active && dirty && <p className="notice">{t('versions.confirmDirty')}</p>}
                  <div className="report-confirm-actions">
                    <button type="button" className="button button-secondary" autoFocus disabled={projects.busy} onClick={() => { setConfirming(null); }}>{t('projects.cancel')}</button>
                    <button type="button" className="button button-primary" disabled={projects.busy} onClick={() => { restore(version); }}>{t('versions.restore')}</button>
                  </div>
                </div> : <button type="button" className="button button-secondary" disabled={projects.busy}
                  aria-label={t('versions.restoreNamed', { date: date(version.savedAt) })} onClick={() => { setConfirming(version.id); }}>{t('versions.restore')}</button>}
              </li>)}
            </ul>}
  </details>;
}
