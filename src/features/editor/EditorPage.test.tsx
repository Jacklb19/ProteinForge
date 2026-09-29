import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from './EditorPage';

describe('EditorPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('accepts typing and marks invalid characters within 100 ms', () => {
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'AC-' } });
    expect(editor).toHaveValue('AC-');
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Posiciones inválidas: 3.')).toBeInTheDocument();
    expect(document.querySelectorAll('mark.invalid-residue')).toHaveLength(1);
  });

  it('updates positions after pasting and correcting the sequence', () => {
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'AC\n--' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByText('Posiciones inválidas: 4, 5.')).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: 'AC\nDE' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'false');
  });

  it('removes a terminal asterisk when entered', () => {
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'ACX*' } });
    expect(editor).toHaveValue('ACX');
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'false');
  });
});
