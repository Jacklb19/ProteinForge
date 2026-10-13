import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlignmentBlocks } from './AlignmentBlocks';
import { BLOCK_COLUMNS, BLOCK_COLUMNS_NARROW, FALLBACK_BLOCK_HEIGHT_PX, NARROW_BLOCK_QUERY } from './config';
import type { AlignmentResult } from './gotoh';
import { spanish } from '../../i18n/es';
import { DEFAULT_LOCALE, languageTags } from '../../i18n/config';
import { translate } from '../../i18n/translate';

class MockResizeObserver {
  observe(): void { /* No layout updates are needed in this test. */ }
  disconnect(): void { /* No observer work is pending. */ }
}

const COLUMNS = 6000;
const sequence = 'A'.repeat(COLUMNS);
const result: AlignmentResult = {
  alignedFirst: sequence,
  alignedSecond: sequence,
  marks: '|'.repeat(COLUMNS),
  columns: COLUMNS,
  score: 0,
  identities: COLUMNS,
  similarities: COLUMNS,
  parameters: { matrix: 'BLOSUM62', mode: 'global', gapOpen: 10, gapExtend: 0.5, terminalGaps: 'free' },
};

/** Header text of the block that covers the given one-based column range. */
function columnsHeader(start: number, end: number): string {
  const format = new Intl.NumberFormat(languageTags[DEFAULT_LOCALE]);
  return translate(DEFAULT_LOCALE, 'alignment.columns', { start: format.format(start), end: format.format(end) });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('virtual alignment blocks', () => {
  it('renders 55-column blocks near the viewport and applies safe height fallback', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    expect(BLOCK_COLUMNS).toBe(55);
    const { container } = render(<AlignmentBlocks result={result} firstName={spanish['alignment.first']} secondName={spanish['alignment.second']} />);
    expect(container.querySelectorAll('.alignment-block').length).toBeLessThan(10);
    expect(screen.getByText('Columnas 1 a 55')).toBeInTheDocument();
    expect(screen.getByText(columnsHeader(1, BLOCK_COLUMNS))).toBeInTheDocument();
    const viewport = container.querySelector('.alignment-viewport');
    if (!viewport) throw new Error('Alignment viewport is missing.');
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: FALLBACK_BLOCK_HEIGHT_PX * 50 });
    fireEvent.scroll(viewport);
    expect(container.querySelectorAll('.alignment-block').length).toBeLessThan(10);
    expect(screen.getByText('Columnas 2.751 a 2.805')).toBeInTheDocument();
    expect(screen.getByText(columnsHeader(50 * BLOCK_COLUMNS + 1, 51 * BLOCK_COLUMNS))).toBeInTheDocument();
  });

  it('names both rows and keeps each block readable as text beside the colored grid', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const pair: AlignmentResult = { ...result, alignedFirst: 'ACD-', alignedSecond: 'ACEF', marks: '||: ', columns: 4, identities: 2, similarities: 3 };
    const { container } = render(<AlignmentBlocks result={pair} firstName="First name" secondName="Second name" />);
    const blocks = container.querySelectorAll('.alignment-block');
    expect(blocks).toHaveLength(1);
    expect(container.querySelector('.alignment-block-head')).toHaveTextContent('First name');
    expect(container.querySelector('.alignment-block-head')).toHaveTextContent(columnsHeader(1, 4));
    expect(container.querySelector('.alignment-block-foot')).toHaveTextContent('Second name');
    expect(container.querySelector('pre.visually-hidden')?.textContent).toBe('ACD-\n||: \nACEF');
    const grid = container.querySelector('.alignment-grid');
    expect(grid).toHaveAttribute('aria-hidden', 'true');
    expect(Array.from(grid?.querySelectorAll('.alignment-column') ?? [], (column) => column.getAttribute('data-kind'))).toEqual(['identical', 'identical', 'similar', 'gap']);
    expect(grid?.querySelector('.residue.is-gap')).toHaveTextContent(spanish['alignment.gapSymbol']);
  });

  it('uses shorter blocks when the narrow layout query matches', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const matchMedia = vi.fn((query: string) => ({ matches: query === NARROW_BLOCK_QUERY, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal('matchMedia', matchMedia);
    render(<AlignmentBlocks result={result} firstName={spanish['alignment.first']} secondName={spanish['alignment.second']} />);
    expect(matchMedia).toHaveBeenCalledWith(NARROW_BLOCK_QUERY);
    expect(screen.getByText(columnsHeader(1, BLOCK_COLUMNS_NARROW))).toBeInTheDocument();
    expect(screen.queryByText(columnsHeader(1, BLOCK_COLUMNS))).not.toBeInTheDocument();
  });
});
