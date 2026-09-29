import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FastaEntry } from './fasta';
import { resolveRowHeight } from './rowHeight';

interface Props {
  onSelect: (entry: FastaEntry) => void;
}

type FastaMessage =
  | { type: 'entries'; entries: FastaEntry[] }
  | { type: 'complete' }
  | { type: 'error'; message: string };

/** Loads FASTA in a worker and virtualizes the available entries. */
export function FastaLoader({ onSelect }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<FastaEntry[]>([]);
  const [status, setStatus] = useState('No hay archivo cargado.');
  const [selection, setSelection] = useState<number | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [dimensions, setDimensions] = useState({ row: 0, list: 0 });
  const worker = useRef<Worker | null>(null);
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
    worker.current?.terminate();
    setEntries([]);
    setSelection(null);
    setScrollOffset(0);
    if (list.current) list.current.scrollTop = 0;
    setStatus('Leyendo archivo FASTA…');

    try {
      const newWorker = new Worker(new URL('./fasta.worker.ts', import.meta.url), { type: 'module' });
      worker.current = newWorker;
      newWorker.onmessage = (event: MessageEvent<FastaMessage>) => {
        if (worker.current !== newWorker) return;
        const message = event.data;
        if (message.type === 'entries') {
          setEntries((current) => [...current, ...message.entries]);
        } else if (message.type === 'complete') {
          setStatus('Archivo FASTA cargado. Elige una entrada para editarla.');
          newWorker.terminate();
          if (worker.current === newWorker) worker.current = null;
        } else {
          setEntries([]);
          setStatus(`Error: ${message.message}`);
          newWorker.terminate();
          if (worker.current === newWorker) worker.current = null;
        }
      };
      newWorker.onerror = () => {
        if (worker.current !== newWorker) return;
        setEntries([]);
        setStatus('Error: no se pudo ejecutar el analizador FASTA.');
        newWorker.terminate();
        if (worker.current === newWorker) worker.current = null;
      };
      newWorker.postMessage(file);
    } catch {
      worker.current = null;
      setStatus('Error: el navegador no pudo iniciar el analizador FASTA.');
    }
  };

  const start = Math.min(
    Math.max(0, entries.length - 1),
    Math.max(0, Math.floor((Number.isFinite(scrollOffset) ? scrollOffset : 0) / rowHeight) - 2),
  );
  const visible = listHeight > 0 ? Math.ceil(listHeight / rowHeight) + 4 : 10;
  const count = tokenHeight.emergencyFallback ? Math.min(visible, 10) : visible;
  const end = Math.min(entries.length, start + count);

  return (
    <section aria-labelledby="fasta-title">
      <h2 id="fasta-title">Cargar FASTA</h2>
      <label htmlFor="fasta-file">Archivo FASTA de hasta 5 MB</label>
      <input
        id="fasta-file"
        type="file"
        accept=".fa,.faa,.fasta,.fsa,text/plain"
        onChange={(event) => {
          loadFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <p role="status" aria-live="polite">{status} {entries.length > 0 ? `${String(entries.length)} entradas encontradas.` : ''}</p>
      {entries.length > 0 && (
        <div
          ref={list}
          className="fasta-list"
          role="listbox"
          aria-label="Entradas FASTA"
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
                  <span>{String(entry.sequence.length)} residuos</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
