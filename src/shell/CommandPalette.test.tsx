import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectContext } from '../features/projects/projectContext';
import type { ProjectContextValue } from '../features/projects/projectContext';
import { ROUTES } from '../shared/navigation';
import { CommandPalette } from './CommandPalette';
import { PALETTE_MAX_PROJECTS, paletteEntries } from './paletteEntries';

const destinations = [{ path: '/analyze', label: 'Analizar' }, { path: '/library', label: 'Biblioteca' }];
const stored = [{ id: '1', name: 'Análisis de insulina' }, { id: '2', name: 'Lisozima' }];

describe('paletteEntries', () => {
  it('lists every destination and project while nothing is typed', () => {
    expect(paletteEntries('', destinations, stored).map(entry => entry.label)).toEqual(['Analizar', 'Biblioteca', 'Análisis de insulina', 'Lisozima']);
  });
  it('matches without regard to case or accents, in tools and projects alike', () => {
    expect(paletteEntries('ANALI', destinations, stored).map(entry => [entry.kind, entry.label])).toEqual([['destination', 'Analizar'], ['project', 'Análisis de insulina']]);
    expect(paletteEntries('  zima ', destinations, stored).map(entry => entry.label)).toEqual(['Lisozima']);
    expect(paletteEntries('xyz', destinations, stored)).toEqual([]);
  });
  it('sends a project to Projects and bounds how many are offered', () => {
    const many = Array.from({ length: PALETTE_MAX_PROJECTS + 5 }, (_, index) => ({ id: String(index), name: `Proyecto ${String(index)}` }));
    const entries = paletteEntries('proyecto', [], many);
    expect(entries).toHaveLength(PALETTE_MAX_PROJECTS);
    expect(new Set(entries.map(entry => entry.path))).toEqual(new Set([ROUTES.projects]));
  });
});

function Where(): React.JSX.Element { return <output data-testid="where">{useLocation().pathname}</output>; }
function open(refresh = vi.fn<ProjectContextValue['refresh']>().mockResolvedValue(true)) {
  const onClose = vi.fn();
  const projects = { items: [{ id: '1', name: 'Análisis de insulina' }], listing: { query: '', order: 'name' }, refresh } as unknown as ProjectContextValue;
  render(<MemoryRouter initialEntries={['/generate']}><ProjectContext.Provider value={projects}>
    <Routes><Route path="*" element={<><Where /><CommandPalette onClose={onClose} /></>} /></Routes>
  </ProjectContext.Provider></MemoryRouter>);
  return { onClose, refresh, field: screen.getByRole('combobox') };
}

describe('CommandPalette', () => {
  it('moves with the arrow keys, wraps around and opens the chosen tool', () => {
    const { onClose, field } = open();
    const options = (): HTMLElement[] => within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(field).toHaveAttribute('aria-activedescendant', options()[0]?.id);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(options().at(-1)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(options()[1]).toHaveTextContent('Comparar');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.alignment);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a project in Projects filtered by its name, keeping the chosen order', () => {
    const { refresh, field } = open();
    fireEvent.change(field, { target: { value: 'insulina' } });
    fireEvent.click(screen.getByRole('option', { name: 'Análisis de insulina' }));
    expect(refresh).toHaveBeenCalledWith(false, { query: 'Análisis de insulina', order: 'name' });
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.projects);
  });

  it('says when nothing matches and does nothing on Enter', () => {
    const { onClose, field } = open();
    fireEvent.change(field, { target: { value: 'zzz' } });
    expect(screen.getByText('Nada coincide con «zzz».')).toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/generate');
  });
});
