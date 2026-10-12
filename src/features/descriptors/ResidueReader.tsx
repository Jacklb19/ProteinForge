import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { READER_OVERSCAN_LINES, RESIDUES_PER_BLOCK } from './config';
import { windowRange } from './chartGeometry';
import { nextReaderPosition, readerLines } from './readerLayout';

interface Props {
  sequence: string;
  windowSize: number;
  selected: number | null;
  onSelect: (position: number) => void;
  describedBy: string;
}

interface Layout {
  blocksPerLine: number;
  lineHeight: number;
  viewportHeight: number;
}

/**
 * Numbered sequence in blocks of ten. The selected residue and the window averaged
 * into its hydropathy value are highlighted; only lines near the viewport are rendered.
 */
export function ResidueReader({ sequence, windowSize, selected, onSelect, describedBy }: Props): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ blocksPerLine: 1, lineHeight: 0, viewportHeight: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const perLine = layout.blocksPerLine * RESIDUES_PER_BLOCK;
  const lineCount = Math.ceil(sequence.length / perLine);
  const hasSequence = sequence.length > 0;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const line = element.querySelector<HTMLElement>('.reader-line');
      const block = element.querySelector<HTMLElement>('.reader-block');
      if (!line || !block) return;
      const gap = Number.parseFloat(getComputedStyle(line).columnGap) || 0;
      const blockWidth = block.getBoundingClientRect().width;
      const blocksPerLine = blockWidth > 0
        ? Math.max(1, Math.floor((line.clientWidth + gap) / (blockWidth + gap)))
        : 1;
      const next = { blocksPerLine, lineHeight: line.getBoundingClientRect().height, viewportHeight: element.clientHeight };
      setLayout((current) => current.blocksPerLine === next.blocksPerLine && current.lineHeight === next.lineHeight
        && current.viewportHeight === next.viewportHeight ? current : next);
    };
    // The observer reports the initial size too, so no synchronous measurement is needed.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    // Block width depends on the sequence font, which may finish loading later.
    const fonts = (document as { fonts?: FontFaceSet }).fonts;
    if (fonts) void fonts.ready.then(measure);
    return () => { active = false; observer?.disconnect(); };
  }, [hasSequence]);

  useEffect(() => {
    const element = viewport.current;
    if (!element || selected === null || layout.lineHeight === 0) return;
    const top = Math.floor((selected - 1) / perLine) * layout.lineHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + layout.lineHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + layout.lineHeight - element.clientHeight;
    }
  }, [selected, perLine, layout.lineHeight]);

  const range = selected === null ? null : windowRange(selected, windowSize, sequence.length);
  const lines = readerLines({
    length: sequence.length,
    perLine,
    lineHeight: layout.lineHeight,
    scrollTop,
    viewportHeight: layout.viewportHeight,
    overscan: READER_OVERSCAN_LINES,
  });

  return (
    <div
      ref={viewport}
      className="residue-reader"
      role="group"
      tabIndex={0}
      aria-label={t('profile.readerLabel', { count: formatNumber(RESIDUES_PER_BLOCK) })}
      aria-describedby={describedBy}
      onScroll={(event) => { setScrollTop(event.currentTarget.scrollTop); }}
      onClick={(event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-position]');
        if (target?.dataset.position) onSelect(Number(target.dataset.position));
      }}
      onKeyDown={(event) => {
        const next = nextReaderPosition(event.key, selected, perLine, sequence.length);
        if (next === null) return;
        event.preventDefault();
        onSelect(next);
      }}
    >
      <div className="reader-content" style={{ height: layout.lineHeight > 0 ? lineCount * layout.lineHeight : undefined }}>
        {lines.map((lineIndex) => {
          const lineStart = lineIndex * perLine;
          const blocks = [];
          for (let blockStart = lineStart; blockStart < Math.min(lineStart + perLine, sequence.length); blockStart += RESIDUES_PER_BLOCK) {
            const blockEnd = Math.min(blockStart + RESIDUES_PER_BLOCK, sequence.length);
            const residues = [];
            for (let index = blockStart; index < blockEnd; index += 1) {
              const position = index + 1;
              const className = position === selected
                ? 'is-selected'
                : range && position >= range.start && position <= range.end ? 'in-window' : undefined;
              residues.push(<span key={position} data-position={position} className={className}>{sequence[index]}</span>);
            }
            blocks.push(
              <span key={blockStart} className="reader-block">
                <span className="reader-number" aria-hidden="true">{formatNumber(blockEnd)}</span>
                <span className="reader-residues">{residues}</span>
              </span>,
            );
          }
          return (
            <div key={lineIndex} className="reader-line" style={layout.lineHeight > 0 ? { top: lineIndex * layout.lineHeight } : undefined}>
              {blocks}
            </div>
          );
        })}
      </div>
    </div>
  );
}
