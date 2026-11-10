import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calculateDescriptors } from './descriptors';
import { MutationFigures, MutationPreview } from './MutationPreview';
import { substitute } from './mutation';
import type { DescriptorState } from './useDescriptors';

const SEQUENCE = 'MKTAYIAKQR';
const current: DescriptorState = { result: calculateDescriptors(SEQUENCE), status: 'current', error: null, excluded: 0 };

describe('substitute', () => {
  it('replaces exactly one residue, counting from 1', () => {
    expect(substitute(SEQUENCE, 1, 'A')).toBe('AKTAYIAKQR');
    expect(substitute(SEQUENCE, 10, 'W')).toBe('MKTAYIAKQW');
    expect(substitute(SEQUENCE, 3, 'D')).toHaveLength(SEQUENCE.length);
  });
  it('refuses a position outside the sequence', () => {
    expect(substitute(SEQUENCE, 0, 'A')).toBeNull();
    expect(substitute(SEQUENCE, 11, 'A')).toBeNull();
    expect(substitute(SEQUENCE, 1.5, 'A')).toBeNull();
  });
});

describe('MutationFigures', () => {
  it('shows each property before and after with a signed change', () => {
    const next = calculateDescriptors('MKTAYIAKQD');
    render(<MutationFigures caption="R10D" current={calculateDescriptors(SEQUENCE)} next={next} />);
    const table = screen.getByRole('table', { name: 'R10D' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    const mass = within(table).getByRole('row', { name: /Masa molecular/ });
    // Arg to Asp loses mass: the change carries its sign.
    expect(within(mass).getAllByRole('cell')[2]).toHaveTextContent(/^[-−]/);
    const charge = within(table).getByRole('row', { name: /Punto isoeléctrico/ });
    expect(within(charge).getAllByRole('cell')[2]).toHaveTextContent(/^[-−]/);
  });
  it('writes no sign when a property does not change', () => {
    const same = calculateDescriptors(SEQUENCE);
    render(<MutationFigures caption="same" current={same} next={same} />);
    const mass = within(screen.getByRole('table')).getByRole('row', { name: /Masa molecular/ });
    expect(within(mass).getAllByRole('cell')[2]).toHaveTextContent(/^0/);
  });
});

describe('MutationPreview', () => {
  it('asks for a residue before offering anything', () => {
    render(<MutationPreview sequence={SEQUENCE} selected={null} base={current} onApply={vi.fn()} />);
    expect(screen.getByText(/Elige un residuo/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('names the selected residue, leaves it out of the choices and applies the chosen one', () => {
    const onApply = vi.fn();
    render(<MutationPreview sequence={SEQUENCE} selected={2} base={current} onApply={onApply} />);
    const choice = screen.getByRole('combobox', { name: 'Sustituir Lys 2 por' });
    expect(within(choice).queryByRole('option', { name: /Lys/ })).not.toBeInTheDocument();
    expect(within(choice).getAllByRole('option')).toHaveLength(19);
    fireEvent.change(choice, { target: { value: 'E' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar al borrador' }));
    expect(onApply).toHaveBeenCalledWith('METAYIAKQR');
  });

  it('never offers the residue already there, even when it was the default choice', () => {
    const onApply = vi.fn();
    render(<MutationPreview sequence="AKT" selected={1} base={current} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar al borrador' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).not.toBe('AKT');
  });
});
