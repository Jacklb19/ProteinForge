import { useEffect, useMemo, useRef, useState } from 'react';
import { updateInvalidPositions, splitStandardResidues, validateSequence } from './sequence';
import { FastaLoader } from './FastaLoader';
import { FastaParser } from './fasta';
import type { FastaEntry } from './fasta';
import { EXAMPLE_SEQUENCES, VALIDATION_DELAY_MS } from './config';
import { useSequenceDraft } from './sequenceDraft';
import { DescriptorPanel } from '../descriptors/DescriptorPanel';
import { useDescriptors } from '../descriptors/useDescriptors';
import { HydropathyProfile } from '../descriptors/HydropathyProfile';
import { useTranslation } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';

/** First entry of a bundled FASTA example. */
function exampleEntry(fasta: string): FastaEntry | undefined {
  const parser = new FastaParser();
  return [...parser.addChunk(fasta), ...parser.finish()][0];
}

/** Sequence input with incremental validation; results update automatically beside it. */
export function EditorPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { text, setText } = useSequenceDraft();
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
    <main className="analysis-page">
      <PageHeading titleKey="editor.title" introduction="editor.introduction" />
      <div className="analysis-layout">
        <div className="analysis-input">
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
          {additional > 0 && <p className="notice" role="note">{t(additional === 1 ? 'editor.additionalOne' : 'editor.additional', { count: formatNumber(additional) })}</p>}
          <FastaLoader onSelect={loadEntry} />
        </div>
        <div className="analysis-results">
          {!hasInput && (
            <section className="empty-state" aria-labelledby="empty-title">
              <h2 id="empty-title">{t('editor.emptyTitle')}</h2>
              <p>{t('editor.emptyText')}</p>
              {EXAMPLE_SEQUENCES.map((example) => (
                <div key={example.accession} className="empty-action">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      const entry = exampleEntry(example.fasta);
                      if (entry) loadEntry(entry);
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
            <DescriptorPanel data={descriptors} />
            <HydropathyProfile text={text} />
          </div>
        </div>
      </div>
    </main>
  );
}
