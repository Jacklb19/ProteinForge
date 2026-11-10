import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../shared/navigation';
import { TourPanel } from './TourPanel';
import { TOUR_STOPS } from './tour';

function Harness(): React.JSX.Element {
  const [stop, setStop] = useState<number | null>(0);
  const { pathname } = useLocation();
  return <>
    <output data-testid="where">{pathname}</output>
    {stop === null ? <p>ended</p> : <TourPanel stop={stop} onStop={setStop} onEnd={() => { setStop(null); }} />}
  </>;
}
const start = (): void => { render(<MemoryRouter initialEntries={[ROUTES.guide]}><Harness /></MemoryRouter>); };

describe('TourPanel', () => {
  it('opens the tool of each stop, takes the focus and says where the visit stands', () => {
    start();
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.analyze);
    expect(screen.getByRole('heading', { name: 'Analizar' })).toHaveFocus();
    expect(screen.getByText(`Parada 1 de ${String(TOUR_STOPS.length)}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.alignment);
    expect(screen.getByRole('heading', { name: 'Comparar' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.analyze);
  });

  it('visits every tool once and ends on the last stop', () => {
    start();
    const visited = [screen.getByTestId('where').textContent];
    for (let step = 1; step < TOUR_STOPS.length; step++) {
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      visited.push(screen.getByTestId('where').textContent);
    }
    expect(visited).toEqual(TOUR_STOPS.map(item => item.path));
    expect(new Set(visited).size).toBe(TOUR_STOPS.length);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(screen.getByText('ended')).toBeInTheDocument();
  });

  it('can be left at any stop', () => {
    start();
    fireEvent.click(screen.getByRole('button', { name: 'Salir del recorrido' }));
    expect(screen.getByText('ended')).toBeInTheDocument();
  });
});
