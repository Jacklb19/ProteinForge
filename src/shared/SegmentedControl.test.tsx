import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('exposes native radios in a named group and reports the chosen value', () => {
    const onChange = vi.fn<(value: number) => void>();
    render(<SegmentedControl legend="Ventana" options={[{ value: 9, label: '9' }, { value: 19, label: '19' }]} value={9} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Ventana' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '9' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '19' }));
    expect(onChange).toHaveBeenCalledWith(19);
  });
});
