import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { updateInvalidPositions, splitStandardResidues, validateSequence } from './sequence';
import { FastaLoader } from './FastaLoader';
import type { FastaEntry } from './fasta';
import { OPEN_PROJECT_STATE, VALIDATION_DELAY_MS } from './config';
import { DEFAULT_EXAMPLE } from './examples';
import { annotationsFor } from './annotations';
import { useSequenceDraft } from './sequenceDraft';
import { DescriptorPanel } from '../descriptors/DescriptorPanel';
import { useDescriptors } from '../descriptors/useDescriptors';
import { HydropathyProfile } from '../descriptors/HydropathyProfile';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { referenceFor } from '../alignment/examples';
import { CompositionBar } from '../chemistry/CompositionBar';
import { StructureStage } from '../structure/StructureStage';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import { ReadingSection } from '../assistant/ReadingSection';
import { analysisFacts } from '../assistant/facts';
import { descriptorCsv, downloadDescriptorCsv } from '../reports/descriptorReport';
import { ProjectControls } from '../projects/ProjectControls';
import { ReportActions } from '../reports/ReportActions';
import { isCurrentReference } from '../library/referenceView';
import { ViewTabs } from '../../shared/ViewTabs';
import { REFERENCE_CATALOG } from '../library/catalog';
import { ProjectContext } from '../projects/projectContext';
import { SaveState } from '../projects/SaveState';
import { useDraftSaveState } from '../projects/draftSaveState';

const MappedStructure = lazy(() => import('../library/MappedStructure').then(module => ({ default: module.MappedStructure })));

type Panel = 'sequence' | 'project' | null;
const opensProject = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'panel' in state && state.panel === OPEN_PROJECT_STATE.panel;
type AnalysisView = 'summary' | 'sequence' | 'profile' | 'structure';
const SEQUENCE_PANEL_ID = 'sequence-panel';
const PROJECT_PANEL_ID = 'project-panel';

/** One protein per page: its sequence, profile and properties, with a single line of actions. */
export function EditorPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { text, setText, profileWindow, setProfileWindow, source, setSource, referenceView, setReferenceView } = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const navigate = useNavigate();
  const location = useLocation();
  const descriptors = useDescriptors(text);
  const validation = useMemo(() => validateSequence(text), [text]);
  const additional = splitStandardResidues(validation.sequence).excluded;
  const [invalidPositions, setInvalidPositions] = useState<number[]>([]);
  // An empty draft or the untouched example opens with the entry ready (the example is selected when the box
  // takes the focus, so pasting replaces it); it stays open while the person types. A sequence brought from
  // Library to be saved opens with project saving shown.
  const [panel, setPanel] = useState<Panel>(() => (opensProject(location.state) ? 'project' : text === '' || text === DEFAULT_EXAMPLE.text ? 'sequence' : null));
  const input = useRef<HTMLTextAreaElement>(null);
  const projects = useContext(ProjectContext);
  const [localSelected, setLocalSelected] = useState<number | null>(() => annotationsFor(source)?.highlight ?? null);
  const activeView = isCurrentReference(referenceView, text, source) ? referenceView : null;
  const [view, setView] = useState<AnalysisView>(() => activeView ? 'structure' : 'summary');
  const selected = activeView ? activeView.position : localSelected;
  const setSelected = (position: number | null): void => {
    setLocalSelected(position);
    if (activeView) setReferenceView({ ...activeView, position });
  };
  const validatedText = useRef('');
  const validatedPositions = useRef<number[]>([]);
  const highlight = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (text === validatedText.current) return;
    const timer = window.setTimeout(() => {
      const nextPositions = updateInvalidPositions(
        validatedText.current,
        text,
        validatedPositions.current,
      );
      validatedText.current = text;
      validatedPositions.current = nextPositions;
      setInvalidPositions(nextPositions);
    }, VALIDATION_DELAY_MS);
    return () => { window.clearTimeout(timer); };
  }, [text]);

  const loadEntry = (entry: FastaEntry): void => {
    validatedText.current = entry.sequence;
    validatedPositions.current = entry.invalidPositions;
    setText(entry.sequence);
    setInvalidPositions(entry.invalidPositions);
    setLocalSelected(null);
  };

  const clear = (): void => { loadEntry({ number: 0, header: '', sequence: '', invalidPositions: [] }); setPanel('sequence'); };
  const restoreExample = (): void => {
    loadEntry({ number: 0, header: '', sequence: DEFAULT_EXAMPLE.text, invalidPositions: [] });
    setSource(DEFAULT_EXAMPLE.source);
    setLocalSelected(annotationsFor(DEFAULT_EXAMPLE.source)?.highlight ?? null);
    // Back on the example the entry stays open, as it arrives, so pasting replaces it again.
    setPanel('sequence');
  };

  /** Opens the entry and puts the caret where it is needed: on a position, or over the whole example. */
  const focusEntry = (position?: number): void => {
    setPanel('sequence');
    window.requestAnimationFrame(() => {
      const box = input.current;
      if (!box) return;
      box.focus();
      if (position !== undefined) box.setSelectionRange(position, position + 1);
    });
  };
  const chooseReference = (reference: (typeof REFERENCE_CATALOG)[number]): void => {
    loadEntry({ number: 0, header: '', sequence: reference.sequence, invalidPositions: [] });
    setSource({ origin: 'catalog', accession: reference.accession, sequence: reference.sequence, entryVersion: null, sequenceVersion: reference.sequenceVersion, retrievedAt: null });
    setReferenceView(null);
  };

  const sendToAlignment = (): void => {
    alignment.update({ first: validation.sequence });
    void navigate(ROUTES.alignment);
  };

  const fragments: React.ReactNode[] = [];
  let start = 0;
  for (const position of invalidPositions) {
    if (position > start) fragments.push(text.slice(start, position));
    fragments.push(
      <mark key={position} className="invalid-residue">
        {text[position]}
      </mark>,
    );
    start = position + 1;
  }
  if (start < text.length) fragments.push(text.slice(start));

  const description = invalidPositions.length === 0
    ? t('editor.noInvalid')
    : t('editor.invalidPositions', { positions: invalidPositions.map((position) => formatNumber(position + 1)).join(', ') });
  const residueCount = validation.sequence.length;
  const hasInput = residueCount > 0 || validation.invalidPositions.length > 0;
  const annotations = annotationsFor(source);
  const reference = referenceFor(validation.sequence);
  const title = annotations ? t(annotations.nameKey) : activeView?.entry ? activeView.entry.name
    : reference ? t(reference.label)
      : hasInput ? t('editor.ownTitle') : t('editor.emptyTitle');
  const count = residueCount > 0 ? t(residueCount === 1 ? 'editor.residueCountOne' : 'editor.residueCount', { count: formatNumber(residueCount) }) : '';
  const isExample = text === DEFAULT_EXAMPLE.text;
  const meta = [source?.accession ?? reference?.accession, annotations?.organism ?? reference?.organism, count, annotations ? t('editor.fullPrecursor') : '']
    .filter(Boolean).join(' · ');
  const saveState = useDraftSaveState(isExample);
  // A new account with no project yet, looking at the untouched example: the card offers the next step.
  const firstUse = isExample && Boolean(projects?.enabled) && !projects?.busy && !projects?.active && projects?.items.length === 0;
  const firstInvalid = invalidPositions[0];
  const descriptorResult = descriptors.result;
  const sequencePanelOpen = panel === 'sequence';
  const toggle = (next: Exclude<Panel, null>): void => { setPanel((current) => (current === next ? null : next)); };

  return (
    <main className="page analysis-page">
      <header className="page-head">
        <div className="page-head-text">
          <h1>{t('workbench.analyzeTitle')}</h1>
          <p className="page-meta">{t('workbench.analyzeIntro')}</p>
        </div>
        <div className="toolbar">
          <button className={`button ${sequencePanelOpen ? 'button-secondary' : 'button-primary'}`} type="button" aria-expanded={sequencePanelOpen} aria-controls={SEQUENCE_PANEL_ID} onClick={() => { toggle('sequence'); }}>
            {t('editor.inputTitle')}
          </button>
          {hasInput && <button className="button button-secondary" type="button" aria-expanded={panel === 'project'} aria-controls={PROJECT_PANEL_ID} onClick={() => { toggle('project'); }}>{t('projects.save')}</button>}
          <ReportActions>
            {hasInput && <button className="button" type="button" disabled={descriptors.status !== 'current'} onClick={() => {
              if (descriptors.status !== 'current' || !descriptors.result) return;
              const methods = Object.fromEntries(DESCRIPTOR_FIELDS.map((field) => [field.key, t(field.methodKey)]));
              downloadDescriptorCsv(descriptorCsv(validation.sequence, descriptors.result, descriptors.excluded, methods));
            }}>{t('report.download')}</button>}
          </ReportActions>
          {residueCount > 0 && invalidPositions.length === 0 && (
            <button className="button button-secondary" type="button" onClick={sendToAlignment}>{t('editor.toAlignment')}</button>
          )}
        </div>
      </header>
      <section className="subject-summary" aria-label={title}>
        <h2>{title}</h2>
        <p className="page-meta">{hasInput ? <><SaveState {...saveState} detail={saveState.kind === 'example' ? t('saveState.exampleDetail') : saveState.detail} />{meta && ` · ${meta}`}</> : t('editor.emptyText')}</p>
        {firstUse && (
          <div className="subject-next" role="group" aria-label={t('editor.switchLabel')}>
            <p>{t('editor.switchLead')}</p>
            <button className="button button-secondary" type="button" onClick={() => { focusEntry(); }}>{t('editor.switchMine')}</button>
            {REFERENCE_CATALOG.filter((item) => item.sequence !== text).map((item) => (
              <button key={item.accession} className="button button-quiet" type="button" onClick={() => { chooseReference(item); }}>{t(item.label)}</button>
            ))}
            <p>{t('editor.switchOr')}</p>
            <Link className="button button-quiet" to={ROUTES.alignment}>{t('editor.switchCompare')}</Link>
          </div>
        )}
      </section>

      {sequencePanelOpen && (
        <section id={SEQUENCE_PANEL_ID} className="tool-panel" aria-labelledby="sequence-panel-title">
          <h2 id="sequence-panel-title" className="visually-hidden">{t('editor.inputTitle')}</h2>
          <div className="field">
            <div className="field-header">
              <label htmlFor="sequence-input">{t(isExample ? 'editor.labelExample' : 'editor.label')}</label>
              {count && <span className="field-meta">{count}</span>}
            </div>
            <div className="editor-layer">
              <pre aria-hidden="true" className="editor-highlight" ref={highlight}>{fragments}{'\n'}</pre>
              <textarea
                ref={input}
                id="sequence-input"
                aria-describedby="sequence-help sequence-status"
                aria-invalid={invalidPositions.length > 0}
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={t('guide.placeholder')}
                value={text}
                onChange={(event) => { setText(event.target.value.replace(/\*([\r\n]*)$/, '$1')); }}
                onFocus={(event) => { if (isExample) event.currentTarget.select(); }}
                onScroll={(event) => {
                  if (highlight.current) {
                    highlight.current.scrollTop = event.currentTarget.scrollTop;
                    highlight.current.scrollLeft = event.currentTarget.scrollLeft;
                  }
                }}
              />
            </div>
            <p id="sequence-status" className="status-message" data-state={invalidPositions.length > 0 ? 'invalid' : 'current'} role="status" aria-live="polite">{hasInput ? description : ''}</p>
            <p id="sequence-help" className="field-help">{isExample ? `${t('editor.helpExample')} ${t('editor.help')}` : t('editor.help')}</p>
          </div>
          {additional > 0 && <p className="notice" role="note">{t(additional === 1 ? 'editor.additionalOne' : 'editor.additional', { count: formatNumber(additional) })}</p>}
          <FastaLoader onSelect={loadEntry} />
          <div className="editor-actions">
            <Link className="button button-secondary" to={ROUTES.library}>{t('library.taskAction')}</Link>
            {hasInput && <button className="button button-secondary" type="button" onClick={clear}>{t('editor.clear')}</button>}
            {text !== DEFAULT_EXAMPLE.text && <button className="button button-quiet" type="button" onClick={restoreExample}>{t('editor.restoreExample')}</button>}
          </div>
        </section>
      )}
      {panel === 'project' && hasInput && (
        <section id={PROJECT_PANEL_ID} className="tool-panel" aria-labelledby="project-panel-title">
          <ProjectControls descriptors={descriptors} />
        </section>
      )}

      {hasInput && <>
        <ViewTabs id="analysis" label={t('workbench.analysisViews')} value={view} onChange={setView}
          options={(['summary', 'sequence', 'profile', 'structure'] as const).map(value => ({ value, label: t(`workbench.${value}`) }))} />
        <div id="analysis-summary-panel" role="tabpanel" aria-labelledby="analysis-summary-tab" hidden={view !== 'summary'} className="analysis-summary">
            <DescriptorPanel data={descriptors} pending={firstInvalid === undefined ? null : {
              position: firstInvalid + 1, character: text[firstInvalid] ?? '', onGo: () => { focusEntry(firstInvalid); },
            }} />
            {/* The reading is asked for next to «How they are calculated», not offered as a section of its own. */}
            {descriptorResult && descriptors.status === 'current' && invalidPositions.length === 0 && <ReadingSection
              subject="analysis" revision={`${validation.sequence}:${String(profileWindow)}`}
              build={() => analysisFacts({ t, formatNumber }, validation.sequence, descriptorResult, profileWindow)} />}
            <p className="notice">{t('workbench.analysisScope')}</p>
            <div className="analysis-overview-grid">
            {residueCount > 0 && invalidPositions.length === 0 && (
              <section aria-labelledby="composition-title">
                <h3 id="composition-title">{t('chemistry.composition')}</h3>
                <CompositionBar sequence={validation.sequence} />
              </section>
            )}
            {annotations && <StructureStage variant="rail" annotations={annotations} selected={selected} onSelect={setSelected}
              caption={<>{t('structure.measured')} · <button className="button button-quiet" type="button" onClick={() => { setView('structure'); }}>{t('structure.openViewer')}</button></>} />}
            </div>
        </div>
        <HydropathyProfile text={text} windowSize={profileWindow} onWindowChange={setProfileWindow} selected={selected} onSelect={setSelected} annotations={annotations}
          view={view === 'sequence' || view === 'profile' || (view === 'structure' && activeView) ? view : 'none'} panelId="analysis" />
        <div id="analysis-structure-panel" role="tabpanel" aria-labelledby="analysis-structure-tab" hidden={view !== 'structure'}>
            {view === 'structure' && (activeView ? <section aria-label={t('library.structureTitle')}>
              <h3>{t('library.structureTitle')}</h3>
              <Suspense fallback={<p className="status-message">{t('library.viewerLoading')}</p>}><MappedStructure compact reference={activeView.source} structures={activeView.structures} pdbId={activeView.pdbId} position={selected} chain={activeView.chain}
                onStructure={pdbId => { setReferenceView({ ...activeView, pdbId, chain: null, position: null }); }}
                onSelect={(position, chain) => { setReferenceView({ ...activeView, position, chain }); }} /></Suspense>
            </section> : annotations ? (
              <StructureStage
                variant="library"
                annotations={annotations}
                selected={selected}
                onSelect={setSelected}
                caption={<>{t('structure.measured')} · <Link className="inline-link" to={ROUTES.library}>{t('structure.openViewer')}</Link></>}
              />
            ) : <p className="notice">{t('workbench.noStructure')} <Link className="inline-link" to={ROUTES.library}>{t('nav.library')}</Link></p>)}
        </div>
      </>}
    </main>
  );
}
