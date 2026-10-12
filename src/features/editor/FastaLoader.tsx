import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FastaEntry } from './fasta';
import { resolveRowHeight } from './rowHeight';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { FASTA_ACCEPT, FASTA_FALLBACK_VISIBLE_ROWS, FASTA_OVERSCAN_ROWS, MAX_FASTA_MEGABYTES } from './config';

const ERROR_STATUSES: readonly TranslationKey[] = ['fasta.error', 'fasta.workerError', 'fasta.startError'];

interface Props {
  onSelect: (entry: FastaEntry) => void;
}

type FastaMessage =
  | { type: 'entries'; entries: FastaEntry[] }
  | { type: 'complete' }
  | { type: 'error'; message: string };

/** Loads FASTA in a worker and virtualizes the available entries. */
export function FastaLoader({ onSelect }: Props): React.JSX.Element {
  const { t, formatNumber, formatUnit } = useTranslation();
  const [entries, setEntries] = useState<FastaEntry[]>([]);
  const [fileName, setFileName] = useState('');
  const [statusKey, setStatusKey] = useState<TranslationKey | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selection, setSelection] = useState<number | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [dimensions, setDimensions] = useState({ row: 0, list: 0 });
  const worker = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const styles = window.getComputedStyle(document.documentElement);
  const tokenHeight = resolveRowHeight(
    styles.getPropertyValue('--height-fasta-row'),
    styles.getPropertyValue('--height-fasta-row-default'),
  );
  const rowHeight = Number.isFinite(dimensions.row) && dimensions.row > 0
    ? dimensions.row : tokenHeight.pixels;
  const listHeight = Number.isFinite(dimensions.list) && dimensions.list > 0
    ? dimensions.list : 0;

  useEffect(() => () => { worker.current?.terminate(); }, []);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active) return;
      const container = list.current;
      const row = container?.querySelector<HTMLElement>('.fasta-entry');
      if (!container || !row) return;
      const measuredRowHeight = row.getBoundingClientRect().height;
      const measuredListHeight = container.getBoundingClientRect().height;
      const measurements = {
        row: Number.isFinite(measuredRowHeight) && measuredRowHeight > 0 ? measuredRowHeight : tokenHeight.pixels,
        list: Number.isFinite(measuredListHeight) && measuredListHeight > 0 ? measuredListHeight : 0,
      };
      setDimensions((current) =>
        current.row === measurements.row && current.list === measurements.list ? current : measurements);
    };
    // Font loading may finish after FASTA entries arrive; measure only then.
    const fonts = (document as { fonts?: FontFaceSet }).fonts;
    if (fonts) void fonts.ready.then(measure);
    else measure();
    return () => { active = false; };
  }, [entries.length, tokenHeight.pixels]);

  const selectEntry = (index: number): void => {
    const entry = entries[index];
    if (!entry) return;
    setSelection(index);
    onSelect(entry);
    if (list.current) {
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < list.current.scrollTop) list.current.scrollTop = top;
      if (listHeight > 0 && bottom > list.current.scrollTop + listHeight) {
        list.current.scrollTop = bottom - listHeight;
      }
    }
  };

  const loadFile = (file: File | undefined): void => {
    if (!file) return;
    setFileName(file.name);
    worker.current?.terminate();
    setEntries([]);
    setSelection(null);
    setScrollOffset(0);
    if (list.current) list.current.scrollTop = 0;
    setStatusKey('fasta.reading');

    try {
      const newWorker = new Worker(new URL('./fasta.worker.ts', import.meta.url), { type: 'module' });
      worker.current = newWorker;
      newWorker.onmessage = (event: MessageEvent<FastaMessage>) => {
        if (worker.current !== newWorker) return;
        const message = event.data;
        if (message.type === 'entries') {
          setEntries((current) => [...current, ...message.entries]);
        } else if (message.type === 'complete') {
          setStatusKey('fasta.loaded');
          newWorker.terminate();
          if (worker.current === newWorker) worker.current = null;
        } else {
          setEntries([]);
          setErrorMessage(message.message);
          setStatusKey('fasta.error');
          newWorker.terminate();
          if (worker.current === newWorker) worker.current = null;
        }
      };
      newWorker.onerror = () => {
        if (worker.current !== newWorker) return;
        setEntries([]);
        setStatusKey('fasta.workerError');
        newWorker.terminate();
        if (worker.current === newWorker) worker.current = null;
      };
      newWorker.postMessage(file);
    } catch {
      worker.current = null;
      setStatusKey('fasta.startError');
    }
  };

  const start = Math.min(
    Math.max(0, entries.length - 1),
    Math.max(0, Math.floor((Number.isFinite(scrollOffset) ? scrollOffset : 0) / rowHeight) - FASTA_OVERSCAN_ROWS),
  );
  const visible = listHeight > 0 ? Math.ceil(listHeight / rowHeight) + 2 * FASTA_OVERSCAN_ROWS : FASTA_FALLBACK_VISIBLE_ROWS;
  const count = tokenHeight.emergencyFallback ? Math.min(visible, FASTA_FALLBACK_VISIBLE_ROWS) : visible;
  const end = Math.min(entries.length, start + count);

  return (
    <section className="fasta-panel" aria-labelledby="fasta-title">
      <h2 id="fasta-title" className="visually-hidden">{t('fasta.title')}</h2>
      <input
        id="fasta-file"
        ref={fileInput}
        hidden
        type="file"
        aria-label={t('fasta.fileLabel', { limit: formatUnit(MAX_FASTA_MEGABYTES, 'megabyte') })}
        accept={FASTA_ACCEPT}
        onChange={(event) => {
          loadFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <div className="file-control">
        <button className="button button-secondary" type="button" onClick={() => { fileInput.current?.click(); }}><Icon name="upload" />{t('fasta.chooseFile')}</button>
        <span className="field-help">{fileName ? t('fasta.selectedFile', { name: fileName }) : t('fasta.fileLabel', { limit: formatUnit(MAX_FASTA_MEGABYTES, 'megabyte') })}</span>
      </div>
      <p className="status-message" data-state={statusKey === 'fasta.reading' ? 'calculating' : statusKey && ERROR_STATUSES.includes(statusKey) ? 'error' : 'idle'} role="status" aria-live="polite">{statusKey ? [t(statusKey, { message: errorMessage }), entries.length > 0 ? t('fasta.entriesFound', { count: formatNumber(entries.length) }) : ''].filter(Boolean).join(' ') : ''}</p>
      {entries.length > 0 && (
        <div
          ref={list}
          className="fasta-list"
          role="listbox"
          aria-label={t('fasta.entriesLabel')}
          aria-activedescendant={selection !== null && selection >= start && selection < end
            ? `fasta-entry-${String(selection)}` : undefined}
          tabIndex={0}
          style={{ '--height-fasta-row-effective': `${String(tokenHeight.pixels)}px` } as React.CSSProperties}
          onScroll={(event) => { setScrollOffset(event.currentTarget.scrollTop); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const currentIndex = selection ?? (event.key === 'ArrowDown' ? -1 : entries.length);
              selectEntry(Math.max(0, Math.min(entries.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1))));
            }
          }}
        >
          <div className="fasta-list-content" style={{ height: `calc(var(--height-fasta-row-effective) * ${String(entries.length)})` }}>
            {entries.slice(start, end).map((entry, localOffset) => {
              const index = start + localOffset;
              return (
                <button
                  className="fasta-entry"
                  id={`fasta-entry-${String(index)}`}
                  key={entry.number}
                  type="button"
                  role="option"
                  aria-selected={selection === index}
                  aria-setsize={entries.length}
                  aria-posinset={index + 1}
                  tabIndex={-1}
                  style={{ top: `calc(var(--height-fasta-row-effective) * ${String(index)})` }}
                  onClick={() => { selectEntry(index); }}
                >
                  <span>{entry.header}</span>
                  <span>{t(entry.sequence.length === 1 ? 'fasta.residueOne' : 'fasta.residues', { count: formatNumber(entry.sequence.length) })}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
