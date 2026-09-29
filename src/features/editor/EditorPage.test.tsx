import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from './EditorPage';

describe('EditorPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('acepta escritura y marca los caracteres inválidos antes de 100 ms', () => {
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'ACX' } });
    expect(editor).toHaveValue('ACX');
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Posiciones inválidas: 3.')).toBeInTheDocument();
    expect(document.querySelectorAll('mark.residuo-invalido')).toHaveLength(1);
  });

  it('actualiza las posiciones después de pegar y corregir la secuencia', () => {
    render(<EditorPage />);
    const editor = screen.getByRole('textbox', { name: /secuencia de aminoácidos/i });
    fireEvent.change(editor, { target: { value: 'AC\nBX' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByText('Posiciones inválidas: 4, 5.')).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: 'AC\nDE' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(editor).toHaveAttribute('aria-invalid', 'false');
  });
});
