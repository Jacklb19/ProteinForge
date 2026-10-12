import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateInvalidPositions, splitStandardResidues, validateSequence } from './sequence';
import { FastaLoader } from './FastaLoader';
import type { FastaEntry } from './fasta';
import { EXAMPLE_SEQUENCES, VALIDATION_DELAY_MS } from './config';
import { exampleEntry } from './examples';
import { useSequenceDraft } from './sequenceDraft';
import { DescriptorPanel } from '../descriptors/DescriptorPanel';
import { useDescriptors } from '../descriptors/useDescriptors';
import { HydropathyProfile } from '../descriptors/HydropathyProfile';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { useTranslation } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';
import { PageHeading } from '../../shared/PageHeading';
import { AnalysisGuide } from '../workspace/AnalysisGuide';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import { descriptorCsv, downloadDescriptorCsv } from '../reports/descriptorReport';
import { ProjectControls } from '../projects/ProjectControls';
import { UNIPROT_URL } from '../library/config';
import { bundledSequenceSource } from './source';

/** Sequence input with incremental validation; results update automatically beside it. */
export function EditorPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { text, setText, profileWindow, setProfileWindow, source, setSource } = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const navigate = useNavigate();
  const descriptors = useDescriptors(text);
  const validation = useMemo(() => validateSequence(text), [text]);
  const additional = splitStandardResidues(validation.sequence).excluded;
  const [invalidPositions, setInvalidPositions] = useState<number[]>([]);
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
  };

  const clear = (): void => { loadEntry({ number: 0, header: '', sequence: '', invalidPositions: [] }); };

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

  return (
    <main className="page analysis-page">
      <PageHeading titleKey="editor.title" introduction="editor.introduction">
        <Link className="button button-secondary" to={ROUTES.library}>{t('library.taskAction')}</Link>
        {hasInput && <button className="button button-secondary" type="button" disabled={descriptors.status !== 'current'} onClick={() => {
          if (descriptors.status !== 'current' || !descriptors.result) return;
          const methods = Object.fromEntries(DESCRIPTOR_FIELDS.map((field) => [field.key, t(field.methodKey)]));
          downloadDescriptorCsv(descriptorCsv(validation.sequence, descriptors.result, descriptors.excluded, methods));
        }}>{t('report.download')}</button>}
        {hasInput && <button className="button button-secondary" type="button" onClick={clear}>{t('editor.clear')}</button>}
        {residueCount > 0 && invalidPositions.length === 0 && (
          <button className="button button-primary" type="button" onClick={sendToAlignment}>{t('editor.toAlignment')}<Icon name="arrow" /></button>
        )}
      </PageHeading>
      <ProjectControls descriptors={descriptors} />
      {source && <p className="sequence-provenance"><a className="inline-link" href={`${UNIPROT_URL}${source.accession}`}>{source.accession} · {t(source.origin === 'catalog' ? 'library.catalogSource' : 'library.uniprotSource')}</a><span className="field-help">{source.sequenceVersion === null ? t('library.fixtureVersion') : t('library.sourceVersion', { version: formatNumber(source.sequenceVersion) })}</span></p>}
      <AnalysisGuide hasInput={hasInput} ready={descriptors.status === 'current'} />
      <div className="analysis-layout">
        <div className="analysis-input card">
          <h2 className="visually-hidden">{t('editor.inputTitle')}</h2>
          <div className="field-header">
            <label htmlFor="sequence-input">{t('editor.label')}</label>
            {residueCount > 0 && <span className="field-meta">{t(residueCount === 1 ? 'editor.residueCountOne' : 'editor.residueCount', { count: formatNumber(residueCount) })}</span>}
          </div>
          <div className="editor-layer">
            <pre aria-hidden="true" className="editor-highlight" ref={highlight}>{fragments}{'\n'}</pre>
            <textarea
              id="sequence-input"
              aria-describedby="sequence-help sequence-status"
              aria-invalid={invalidPositions.length > 0}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={t('guide.placeholder')}
              value={text}
              onChange={(event) => { setText(event.target.value.replace(/\*([\r\n]*)$/, '$1')); }}
              onScroll={(event) => {
                if (highlight.current) {
                  highlight.current.scrollTop = event.currentTarget.scrollTop;
                  highlight.current.scrollLeft = event.currentTarget.scrollLeft;
                }
              }}
            />
          </div>
          <p id="sequence-status" className="status-message" data-state={invalidPositions.length > 0 ? 'invalid' : 'current'} role="status" aria-live="polite">{hasInput ? description : ''}</p>
          <p id="sequence-help" className="field-help">{t('editor.help')}</p>
          <details className="context-help"><summary>{t('guide.whatIsSequence')}</summary><p>{t('guide.sequenceHelp')}</p><p>{t('guide.automatic')}</p></details>
          {additional > 0 && <p className="notice" role="note">{t(additional === 1 ? 'editor.additionalOne' : 'editor.additional', { count: formatNumber(additional) })}</p>}
          <FastaLoader onSelect={loadEntry} />
        </div>
        <div className="analysis-results">
          {!hasInput && (
            <section className="empty-state" aria-labelledby="empty-title">
              <span className="task-symbol"><Icon name="flask" /></span>
              <h2 id="empty-title">{t('editor.emptyTitle')}</h2>
              <p>{t('editor.emptyText')}</p>
              {EXAMPLE_SEQUENCES.map((example) => (
                <div key={example.accession} className="empty-action">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      const entry = exampleEntry(example.fasta);
                      if (entry) { loadEntry(entry); setSource(bundledSequenceSource(entry)); }
                    }}
                  >
                    {t('examples.try', { name: t(example.labelKey) })}
                  </button>
                  <span className="field-help">{t('examples.source', { accession: example.accession })}</span>
                </div>
              ))}
            </section>
          )}
          <div className="analysis-sections" hidden={!hasInput}>
            {descriptors.status === 'current' && <p className="analysis-ready" role="status"><Icon name="check" />{t('guide.resultsReady')}</p>}
            <DescriptorPanel data={descriptors} />
            <HydropathyProfile text={text} windowSize={profileWindow} onWindowChange={setProfileWindow} />
          </div>
        </div>
      </div>
    </main>
  );
}
