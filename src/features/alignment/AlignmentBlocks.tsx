import { useEffect, useRef, useState } from 'react';
import type { AlignmentResult } from './gotoh';
import { useTranslation } from '../../i18n';
import {
  ALIGNMENT_MARKS, BLOCK_COLUMNS, BLOCK_OVERSCAN, FALLBACK_BLOCK_HEIGHT_PX, FALLBACK_VIEWPORT_HEIGHT_PX,
} from './config';

function blockHeight(element: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue('--height-alignment-block'));
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_BLOCK_HEIGHT_PX;
}

function highlightedResidues(sequence: string, marks: string): React.JSX.Element[] {
  return Array.from(sequence, (residue, index) => {
    const mark = marks[index];
    const className = mark === ALIGNMENT_MARKS.identical ? 'alignment-identical' : mark === ALIGNMENT_MARKS.similar ? 'alignment-similar' : undefined;
    return <span key={index} className={className}>{residue}</span>;
  });
}

/** Renders only alignment blocks near the scroll viewport. */
export function AlignmentBlocks({ result }: { result: AlignmentResult }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(FALLBACK_VIEWPORT_HEIGHT_PX);
  const [rowHeight, setRowHeight] = useState(FALLBACK_BLOCK_HEIGHT_PX);
  const count = Math.ceil(result.columns / BLOCK_COLUMNS);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      setHeight(element.clientHeight);
      setRowHeight(blockHeight(element));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, []);

  const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight) - BLOCK_OVERSCAN);
  const lastVisible = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + BLOCK_OVERSCAN);
  const blocks = Array.from({ length: Math.max(0, lastVisible - firstVisible) }, (_, offset) => {
    const index = firstVisible + offset;
    const start = index * BLOCK_COLUMNS;
    const end = Math.min(start + BLOCK_COLUMNS, result.columns);
    const marks = result.marks.slice(start, end);
    return (
      <div key={index} className="alignment-block" style={{ top: index * rowHeight }}>
        <p>{t('alignment.columns', { start: formatNumber(start + 1), end: formatNumber(end) })}</p>
        <pre>{highlightedResidues(result.alignedFirst.slice(start, end), marks)}</pre>
        <pre aria-hidden="true">{marks}</pre>
        <pre>{highlightedResidues(result.alignedSecond.slice(start, end), marks)}</pre>
      </div>
    );
  });

  return (
    <div ref={viewport} className="alignment-viewport" tabIndex={0} role="region" aria-label={t('alignment.blocksRegion')} onScroll={(event) => { setScrollTop(event.currentTarget.scrollTop); }}>
      <div className="alignment-content" style={{ height: count * rowHeight }}>{blocks}</div>
    </div>
  );
}
