import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlignmentBlocks } from './AlignmentBlocks';
import type { AlignmentResult } from './gotoh';

class MockResizeObserver {
  observe(): void { /* No layout updates are needed in this test. */ }
  disconnect(): void { /* No observer work is pending. */ }
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('virtual alignment blocks', () => {
  it('renders 60-column blocks near the viewport and applies safe height fallback', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const sequence = 'A'.repeat(6000);
    const result: AlignmentResult = {
      alignedFirst: sequence,
      alignedSecond: sequence,
      marks: '|'.repeat(6000),
      columns: 6000,
      score: 0,
      identities: 6000,
      similarities: 6000,
      parameters: { matrix: 'BLOSUM62', mode: 'global', gapOpen: 10, gapExtend: 0.5, terminalGaps: 'free' },
    };
    const { container } = render(<AlignmentBlocks result={result} />);
    expect(container.querySelectorAll('.alignment-block').length).toBeLessThan(10);
    expect(screen.getByText('Columnas 1 a 60')).toBeInTheDocument();
    const viewport = container.querySelector('.alignment-viewport');
    if (!viewport) throw new Error('Alignment viewport is missing.');
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 112 * 50 });
    fireEvent.scroll(viewport);
    expect(container.querySelectorAll('.alignment-block').length).toBeLessThan(10);
    expect(screen.getByText('Columnas 3.001 a 3.060')).toBeInTheDocument();
  });
});
