import { useEffect, useRef, useState } from 'react';
import { updateInvalidPositions, splitStandardResidues, validateSequence } from './sequence';
import { FastaLoader } from './FastaLoader';
import type { FastaEntry } from './fasta';
import { DescriptorPanel } from '../descriptors/DescriptorPanel';
import { useDescriptors } from '../descriptors/useDescriptors';
import { HydropathyProfile } from '../descriptors/HydropathyProfile';
import { useTranslation } from '../../i18n';

const VALIDATION_DELAY_MS = 45;

/** Sequence editor with incremental validation and accessible status. */
export function EditorPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const [text, setText] = useState('');
  const descriptors = useDescriptors(text);
  const additional = splitStandardResidues(validateSequence(text).sequence).excluded;
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

  const positions = new Set(invalidPositions);
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

  const description = positions.size === 0
    ? t('editor.noInvalid')
    : t('editor.invalidPositions', { positions: invalidPositions.map((position) => formatNumber(position + 1)).join(', ') });

  return (
    <main className="editor-page">
      <header>
        <h1>{t('editor.title')}</h1>
        <p>{t('editor.introduction')}</p>
      </header>
      <section aria-labelledby="sequence-title">
        <h2 id="sequence-title">{t('editor.section')}</h2>
        <label htmlFor="sequence-input">{t('editor.label')}</label>
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
        <p id="sequence-help">{t('editor.help')}</p>
        <p id="sequence-status" role="status" aria-live="polite">{description}</p>
        {additional > 0 && <p role="note">{t(additional === 1 ? 'editor.additionalOne' : 'editor.additional', { count: formatNumber(additional) })}</p>}
      </section>
      <FastaLoader onSelect={(entry: FastaEntry) => {
        validatedText.current = entry.sequence;
        validatedPositions.current = entry.invalidPositions;
        setText(entry.sequence);
        setInvalidPositions(entry.invalidPositions);
      }} />
      <DescriptorPanel data={descriptors} />
      <HydropathyProfile text={text} />
    </main>
  );
}
