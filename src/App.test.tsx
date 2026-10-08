import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { spanish } from './i18n/es';

describe('App', () => {
  it('opens on the landing page with the main tools in the navigation', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: spanish['landing.artLabel'] })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: spanish['nav.main'] });
    expect(navigation).toHaveTextContent(spanish['nav.analyze']);
    expect(navigation).toHaveTextContent(spanish['nav.alignment']);
    expect(screen.getByRole('link', { name: spanish['shell.signIn'] })).toBeInTheDocument();
  });
});
