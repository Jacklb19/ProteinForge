import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renderiza el editor de secuencias', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /editor de secuencias/i,
      }),
    ).toBeInTheDocument();
  });
});
