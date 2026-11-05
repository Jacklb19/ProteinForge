import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from './EditorPage';
import { DEFAULT_EXAMPLE } from './examples';
import { ExampleProviders, WorkspaceProviders } from '../../test/WorkspaceProviders';
import { spanish } from '../../i18n/es';
import { DEFAULT_LOCALE } from '../../i18n/config';
import { translate } from '../../i18n/translate';

const CHANGE_SEQUENCE = spanish['editor.inputTitle'];

/** The input action keeps the same visible and accessible name at every width. */
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
    expect(screen.getByRole('heading', { level: 2, name: spanish['editor.emptyTitle'] })).toBeInTheDocument();
    const toggle = changeButton();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'sequence-panel');
    expect(document.getElementById('sequence-panel')).toContainElement(screen.getByRole('textbox', { name: spanish['editor.label'] }));
    expect(screen.queryByRole('button', { name: spanish['projects.save'] })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: spanish['editor.toAlignment'] })).not.toBeInTheDocument();
    expect(screen.queryByText(spanish['report.export'])).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: spanish['editor.label'] }), { target: { value: 'ACDE' } });
    expect(screen.getByRole('heading', { level: 2, name: spanish['editor.ownTitle'] })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue('ACDE');
    expect(screen.getByRole('button', { name: spanish['projects.save'] })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(spanish['report.export']).tagName).toBe('SUMMARY');
    expect(screen.getByRole('button', { name: spanish['report.download'] })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByRole('button', { name: spanish['editor.toAlignment'] })).toBeEnabled();
  });

  it('opens on the bundled example with its entry open, selected on focus so pasting replaces it', () => {
    render(<EditorPage />, { wrapper: ExampleProviders });
    expect(screen.getByRole('heading', { level: 2, name: spanish['examples.insulinName'] })).toBeInTheDocument();
    const toggle = changeButton();
    expect(toggle).toHaveTextContent(spanish['editor.inputTitle']);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('sequence-panel');
    const editor = screen.getByRole('textbox', { name: spanish['editor.labelExample'] });
    expect(panel).toContainElement(editor);
    expect(panel).toContainElement(screen.getByRole('region', { name: spanish['fasta.title'] }));
    expect(editor).toHaveValue(DEFAULT_EXAMPLE.text);
    expect(editor).toHaveAccessibleDescription(expect.stringContaining(spanish['editor.helpExample']) as string);
    fireEvent.focus(editor);
    expect((editor as HTMLTextAreaElement).selectionStart).toBe(0);
    expect((editor as HTMLTextAreaElement).selectionEnd).toBe(DEFAULT_EXAMPLE.text.length);
    expect(screen.queryByRole('button', { name: spanish['editor.restoreExample'] })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: spanish['editor.clear'] }));
    expect(screen.getByRole('heading', { level: 2, name: spanish['editor.emptyTitle'] })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue('');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: spanish['editor.clear'] })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: spanish['editor.restoreExample'] }));
    expect(screen.getByRole('heading', { level: 2, name: spanish['examples.insulinName'] })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: spanish['editor.labelExample'] })).toHaveValue(DEFAULT_EXAMPLE.text);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('sequence-panel')).toBeNull();
  });

  it('covers the previous figures while a character is not a residue and leads to it', () => {
    vi.useFakeTimers();
    render(<EditorPage />, { wrapper: ExampleProviders });
    const editor = screen.getByRole('textbox', { name: spanish['editor.labelExample'] });
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.change(editor, { target: { value: 'ACD1EF' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByText(translate('es', 'descriptors.pending', { position: '4', char: '1' }))).toBeInTheDocument();
    expect(screen.queryByText('11.980,91', { exact: false })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: translate('es', 'descriptors.goTo', { position: '4' }) }));
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
  });
});
