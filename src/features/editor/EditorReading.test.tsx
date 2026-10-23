import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExampleProviders } from '../../test/WorkspaceProviders';
import { calculateDescriptors } from '../descriptors/descriptors';
import { useDescriptors } from '../descriptors/useDescriptors';
import { DEFAULT_EXAMPLE } from './examples';
import { EditorPage } from './EditorPage';

vi.mock('../descriptors/useDescriptors', () => ({ useDescriptors: vi.fn() }));
vi.mock('../assistant/ReadingSection', () => ({ ReadingSection: () => <section aria-label="Test reading" /> }));

const RESULT = calculateDescriptors(DEFAULT_EXAMPLE.text);

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(useDescriptors).mockReturnValue({ result: RESULT, status: 'current', error: null, excluded: 0 });
});
afterEach(() => { vi.useRealTimers(); });

it('withdraws the reading while previous descriptor values await recalculation or have failed', () => {
  const view = render(<EditorPage />, { wrapper: ExampleProviders });
  expect(screen.getByRole('region', { name: 'Test reading' })).toBeInTheDocument();

  for (const status of ['calculating', 'error'] as const) {
    // The worker keeps its last result while it calculates; those old figures must not be sent.
    vi.mocked(useDescriptors).mockReturnValue({ result: RESULT, status, error: null, excluded: 0 });
    view.rerender(<EditorPage />);
    expect(screen.queryByRole('region', { name: 'Test reading' })).not.toBeInTheDocument();
  }

  vi.mocked(useDescriptors).mockReturnValue({ result: RESULT, status: 'current', error: null, excluded: 0 });
  view.rerender(<EditorPage />);
  expect(screen.getByRole('region', { name: 'Test reading' })).toBeInTheDocument();
});
