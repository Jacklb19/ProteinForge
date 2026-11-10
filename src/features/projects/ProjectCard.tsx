import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { languageTags } from '../../i18n/locale';
import { SequenceRibbon } from '../chemistry/SequenceRibbon';
import type { ProjectSummary } from './contracts';
import { PROJECT_MASS_DA_PER_KDA, PROJECT_PREVIEW_PRECISION, PROJECT_RELATIVE_INTERVALS, PROJECT_RELATIVE_NOW_SECONDS } from './config';

export type ProjectDestination = 'analyze' | 'alignment' | 'laboratory' | 'generator';
export type ProjectAction = 'rename' | 'duplicate' | 'share' | 'delete';
/**
 * A save waiting for the connection: `note` replaces the date, `actions` the open buttons (`false` hides them),
 * `section` follows the footer (a conflict), and `pending` marks a project that exists only in this tab.
 */
export interface CardSync { note: ReactNode; actions?: ReactNode | false; section?: ReactNode; pending?: boolean }
/** `children`: extra evidence kept elsewhere, such as the project's saved reports, shown after its details. `offline` locks rename, copy and delete. */
interface Props { project: ProjectSummary; busy: boolean; active: boolean; dirty: boolean; showRuns?: boolean; offline?: boolean; sync?: CardSync | null; onOpen: (destination?: ProjectDestination) => void; onAction: (action: ProjectAction) => void; children?: ReactNode }

/** Saved scientific evidence; rendering never calculates or retrieves a full project. */
export function ProjectCard({ project, busy, active, dirty, showRuns = false, offline = false, sync = null, onOpen, onAction, children }: Props): React.JSX.Element {
  const { t, locale, formatDate, formatNumber } = useTranslation();
  const menu = useRef<HTMLDetailsElement>(null);
  const preview = project.preview;
  const descriptors = preview?.descriptors;
  const comparison = preview?.alignment;
  const source = preview?.source;
  const precision = PROJECT_PREVIEW_PRECISION;
  const [now] = useState(Date.now);
  const seconds = (new Date(project.updatedAt).getTime() - now) / 1_000;
  const interval = PROJECT_RELATIVE_INTERVALS.find(item => Math.abs(seconds) >= item.seconds);
  const relative = Math.abs(seconds) < PROJECT_RELATIVE_NOW_SECONDS || !interval ? t('projects.justNow')
    : new Intl.RelativeTimeFormat(languageTags[locale], { numeric: 'auto' }).format(Math.round(seconds / interval.seconds), interval.unit);
  useEffect(() => {
    const outside = (event: PointerEvent): void => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); };
  }, []);
  const ribbon = (prefix: string, length: number, label?: string): React.JSX.Element | null => prefix ? <div className="project-preview-ribbon">
    <SequenceRibbon sequence={prefix} label={`${label ? `${label}: ` : ''}${t('projects.prefixLabel', { sequence: prefix })}`} />
    <p>{label && <>{label} · </>}{t('projects.prefix', { count: formatNumber(prefix.length), length: formatNumber(length) })}</p>
  </div> : null;
  const metric = (label: string, value: string): React.JSX.Element => <div><dt>{label}</dt><dd>{value}</dd></div>;
  return <article className="project-card" data-active={active} data-conflict={Boolean(sync?.section) || undefined} aria-label={project.name}>
    {!sync?.pending && <details className="project-card-menu" ref={menu} onKeyDown={event => {
      if (event.key === 'Escape' && menu.current) { event.preventDefault(); menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
    }}>
      <summary aria-label={t('projects.actionsNamed', { name: project.name })}><span aria-hidden="true">⋯</span></summary>
      <div className="project-card-options">{(['rename', 'duplicate', 'share', 'delete'] as const).map(action => <button key={action} type="button" disabled={busy || offline} className={`button button-quiet${action === 'delete' ? ' link-danger' : ''}`} aria-label={t(`projects.${action}Named`, { name: project.name })} onClick={() => {
        if (menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } onAction(action);
      }}>{t(`projects.${action}`)}</button>)}</div>
    </details>}
    <div className="project-card-body">
      <p className="project-kind">{t(comparison ? preview.sequenceLength ? 'projects.mixed' : 'projects.comparison' : preview?.hasLaboratory && !preview.sequenceLength ? 'workbench.laboratory' : 'projects.analysis')}</p>
      {/* Focusable from code only: a settled conflict returns the focus here. */}
      <h2 tabIndex={-1}>{project.name}</h2>
      {preview?.hasLaboratory && <p className="project-origin">{t(preview.laboratoryVariants === 1 ? 'lab.projectVariantsOne' : 'lab.projectVariants', { count: preview.laboratoryVariants ?? 0 })}</p>}
      {showRuns && Boolean(preview?.generatorRuns) && <p className="project-origin">{t(preview?.generatorRuns === 1 ? 'projects.generatorRunsOne' : 'projects.generatorRuns', { count: formatNumber(preview?.generatorRuns ?? 0) })}</p>}
      {source && <p className="project-origin">{t(source.origin === 'catalog' ? 'projects.catalogSource' : 'projects.uniprotSource', { accession: source.accession })}</p>}
      {preview && <p className="project-length">{comparison && !preview.sequenceLength ? t('projects.comparisonLengths', { first: formatNumber(comparison.firstLength), second: formatNumber(comparison.secondLength) }) : t('fasta.residues', { count: formatNumber(preview.sequenceLength) })}</p>}
      {active && <p className="field-help project-active">{t(dirty ? 'projects.activeDirty' : 'projects.active')}</p>}
      {!preview && <p className="field-help project-evidence-note">{t('projects.noPreview')}</p>}
      {comparison && !comparison.result && <p className="field-help">{t('projects.noAlignment')} {comparison.matrix} · {t(`alignment.${comparison.mode}`)}</p>}
      {preview && <details className="project-scientific-details"><summary>{t('workbench.projectDetails')}</summary>

        {ribbon(preview.sequencePrefix, preview.sequenceLength)}
        {descriptors ? <dl className="project-metrics">
          {metric(t('projects.mass'), t('projects.massUnit', { value: formatNumber(descriptors.massDa / PROJECT_MASS_DA_PER_KDA, { minimumFractionDigits: precision.mass, maximumFractionDigits: precision.mass }) }))}
          {metric(t('projects.pi'), formatNumber(descriptors.isoelectricPoint, { minimumFractionDigits: precision.pi, maximumFractionDigits: precision.pi }))}
          {metric(t('descriptors.gravy'), formatNumber(descriptors.gravy, { minimumFractionDigits: precision.gravy, maximumFractionDigits: precision.gravy }))}
        </dl> : preview.sequenceLength > 0 && <p className="field-help project-evidence-note">{t('projects.noResults')}</p>}
        {preview.excluded > 0 && <p className="field-help">{t(preview.excluded === 1 ? 'projects.excludedOne' : 'projects.excluded', { count: formatNumber(preview.excluded) })}</p>}
        {comparison && <section className="project-comparison" aria-label={t('projects.comparison')}>
          {preview.sequenceLength > 0 && <p className="project-origin">{t('projects.comparisonLengths', { first: formatNumber(comparison.firstLength), second: formatNumber(comparison.secondLength) })}</p>}
          {ribbon(comparison.firstPrefix, comparison.firstLength, t('alignment.first'))}
          {ribbon(comparison.secondPrefix, comparison.secondLength, t('alignment.second'))}
          {comparison.result ? <dl className="project-metrics">
            {metric(t('alignment.identity'), formatNumber(comparison.result.identities / comparison.result.columns, { style: 'percent', maximumFractionDigits: precision.percent }))}
            {metric(t('alignment.similarity'), formatNumber(comparison.result.similarities / comparison.result.columns, { style: 'percent', maximumFractionDigits: precision.percent }))}
            {metric(t(`alignment.${comparison.mode}`), comparison.matrix)}
          </dl> : null}
        </section>}

      </details>}
      {children}
    </div>
    {/* An open conflict takes the footer's place: the choice is the only action left on the row. */}
    {!sync?.section && <footer className="project-card-footer">
      {sync ? sync.note : <time dateTime={project.updatedAt} title={formatDate(new Date(project.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })}>{relative}</time>}
      {sync?.actions === false ? null : sync?.actions ?? <div className="project-open-actions">
        {preview?.hasLaboratory && <button type="button" className="button button-quiet" disabled={busy} aria-label={t('lab.openProjectNamed',{name:project.name})} onClick={()=>{onOpen('laboratory');}}>{t('lab.openProject')}</button>}
        {(Boolean(preview?.sequenceLength) || !comparison) && <button type="button" className="button button-quiet" disabled={busy} aria-label={t(comparison ? 'projects.openAnalysisNamed' : 'projects.openNamed', { name: project.name })} onClick={() => { onOpen(preview ? 'analyze' : undefined); }}>{t(preview ? 'projects.openAnalysis' : 'projects.open')}</button>}
        {showRuns && Boolean(preview?.generatorRuns) && <button type="button" className="button button-quiet" disabled={busy} aria-label={t('projects.openRunsNamed', { name: project.name })} onClick={() => { onOpen('generator'); }}>{t('projects.openRuns')}</button>}
        {comparison && <button type="button" className="button button-quiet" disabled={busy} aria-label={t('projects.openAlignmentNamed', { name: project.name })} onClick={() => { onOpen('alignment'); }}>{t('projects.openAlignment')}</button>}
      </div>}
    </footer>}
    {sync?.section}
  </article>;
}
