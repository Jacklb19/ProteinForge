import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from './EditorPage';
import { DEFAULT_EXAMPLE } from './examples';
import { ExampleProviders, WorkspaceProviders } from '../../test/WorkspaceProviders';
import { spanish } from '../../i18n/es';
import { DEFAULT_LOCALE } from '../../i18n/config';
import { translate } from '../../i18n/translate';

const CHANGE_SEQUENCE = `${spanish['editor.change']} ${spanish['editor.changeObject']}`;

/** The label is split so narrow toolbars can shorten it; the button is matched by its full visible text. */
function changeButton(): HTMLElement {
  return screen.getByRole('button', { name: (_, element) => element.textContent === CHANGE_SEQUENCE });
}

function invalidPositions(positions: string): string {
  return translate(DEFAULT_LOCALE, 'editor.invalidPositions', { positions });
}

describe('EditorPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('accepts typing and marks invalid characters within 100 ms', () => {
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    const editor = screen.getByRole('textbox', { name: spanish['editor.label'] });
    fireEvent.change(editor, { target: { value: 'AC-' } });
    expect(editor).toHaveValue('AC-');
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Posiciones inválidas: 3.')).toBeInTheDocument();
    expect(screen.getByText(invalidPositions('3'))).toBeInTheDocument();
    expect(document.querySelectorAll('mark.invalid-residue')).toHaveLength(1);
  });

  it('updates positions after pasting and correcting the sequence', () => {
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    const editor = screen.getByRole('textbox', { name: spanish['editor.label'] });
    fireEvent.change(editor, { target: { value: 'AC\n--' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByText(invalidPositions('4, 5'))).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: 'AC\nDE' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'false');
  });

  it('removes a terminal asterisk when entered', () => {
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    const editor = screen.getByRole('textbox', { name: spanish['editor.label'] });
    fireEvent.change(editor, { target: { value: 'ACX*' } });
    expect(editor).toHaveValue('ACX');
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'false');
  });

  it('starts an empty draft with the sequence panel open and nothing to save or align', () => {
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    expect(screen.getByRole('heading', { level: 1, name: spanish['editor.emptyTitle'] })).toBeInTheDocument();
    const toggle = changeButton();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'sequence-panel');
    expect(document.getElementById('sequence-panel')).toContainElement(screen.getByRole('textbox', { name: spanish['editor.label'] }));
    expect(screen.queryByRole('button', { name: spanish['projects.save'] })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: spanish['editor.toAlignment'] })).not.toBeInTheDocument();
    expect(screen.queryByText(spanish['report.export'])).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: spanish['editor.label'] }), { target: { value: 'ACDE' } });
    expect(screen.getByRole('heading', { level: 1, name: spanish['editor.ownTitle'] })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue('ACDE');
    expect(screen.getByRole('button', { name: spanish['projects.save'] })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(spanish['report.export']).tagName).toBe('SUMMARY');
    expect(screen.getByRole('button', { name: spanish['report.download'] })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByRole('button', { name: spanish['editor.toAlignment'] })).toBeEnabled();
  });

  it('opens on the bundled example and keeps its editor behind the change button', () => {
    render(<EditorPage />, { wrapper: ExampleProviders });
    expect(screen.getByRole('heading', { level: 1, name: spanish['examples.insulinName'] })).toBeInTheDocument();
    const toggle = changeButton();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: spanish['editor.label'] })).not.toBeInTheDocument();
    expect(document.getElementById('sequence-panel')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('sequence-panel');
    const editor = screen.getByRole('textbox', { name: spanish['editor.label'] });
    expect(panel).toContainElement(editor);
    expect(panel).toContainElement(screen.getByRole('region', { name: spanish['fasta.title'] }));
    expect(editor).toHaveValue(DEFAULT_EXAMPLE.text);
    expect(screen.queryByRole('button', { name: spanish['editor.restoreExample'] })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: spanish['editor.clear'] }));
    expect(screen.getByRole('heading', { level: 1, name: spanish['editor.emptyTitle'] })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue('');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: spanish['editor.clear'] })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: spanish['editor.restoreExample'] }));
    expect(screen.getByRole('heading', { level: 1, name: spanish['examples.insulinName'] })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: spanish['editor.label'] })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue(DEFAULT_EXAMPLE.text);
    fireEvent.click(toggle);
    expect(document.getElementById('sequence-panel')).toBeNull();
  });
});
