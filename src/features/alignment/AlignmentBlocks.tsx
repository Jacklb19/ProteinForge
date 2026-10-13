import { useEffect, useRef, useState } from 'react';
import type { AlignmentResult } from './gotoh';
import { useTranslation } from '../../i18n';
import { residueClass } from '../chemistry/config';
import {
  BLOCK_COLUMNS, BLOCK_COLUMNS_NARROW, BLOCK_OVERSCAN, FALLBACK_BLOCK_HEIGHT_PX, FALLBACK_VIEWPORT_HEIGHT_PX, GAP_CHARACTER,
  NARROW_BLOCK_QUERY,
} from './config';
import { columnKind } from './columns';

function blockHeight(element: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue('--height-alignment-block'));
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_BLOCK_HEIGHT_PX;
}

function columnsPerBlock(): number {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_BLOCK_QUERY).matches ? BLOCK_COLUMNS_NARROW : BLOCK_COLUMNS;
}

interface Props {
  result: AlignmentResult;
  /** Names shown beside each row; they default to the generic labels of the inputs. */
  firstName: string;
  secondName: string;
}

/** Renders only alignment blocks near the scroll viewport; columns that differ carry their residue chemistry. */
export function AlignmentBlocks({ result, firstName, secondName }: Props): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(FALLBACK_VIEWPORT_HEIGHT_PX);
  const [rowHeight, setRowHeight] = useState(FALLBACK_BLOCK_HEIGHT_PX);
  const [perBlock, setPerBlock] = useState(columnsPerBlock);
  const count = Math.ceil(result.columns / perBlock);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      setHeight(element.clientHeight);
      setRowHeight(blockHeight(element));
      setPerBlock(columnsPerBlock());
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
    const start = index * perBlock;
    const end = Math.min(start + perBlock, result.columns);
    const first = result.alignedFirst.slice(start, end);
    const second = result.alignedSecond.slice(start, end);
    const cell = (residue: string): React.JSX.Element => (residue === GAP_CHARACTER
      ? <span className="residue is-gap">{t('alignment.gapSymbol')}</span>
      : <span className="residue" data-chem={residueClass(residue)}>{residue}</span>);
    return (
      <div key={index} className="alignment-block" style={{ top: index * rowHeight }}>
        <p className="alignment-block-head"><span>{firstName}</span><span>{t('alignment.columns', { start: formatNumber(start + 1), end: formatNumber(end) })}</span></p>
        <div className="alignment-grid" style={{ '--alignment-columns': perBlock } as React.CSSProperties} aria-hidden="true">
          {Array.from(first, (residue, column) => (
            <span key={column} className="alignment-column" data-kind={columnKind(result, start + column)}>{cell(residue)}{cell(second[column] ?? GAP_CHARACTER)}</span>
          ))}
        </div>
        <p className="alignment-block-foot"><span>{secondName}</span></p>
        <pre className="visually-hidden">{first}{'\n'}{result.marks.slice(start, end)}{'\n'}{second}</pre>
      </div>
    );
  });

  return (
    <div ref={viewport} className="alignment-viewport" tabIndex={0} role="region" aria-label={t('alignment.blocksRegion')} onScroll={(event) => { setScrollTop(event.currentTarget.scrollTop); }}>
      <div className="alignment-content" style={{ height: count * rowHeight }}>{blocks}</div>
    </div>
  );
}
