import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { spanish } from './i18n/es';

describe('App', () => {
  it('opens on the public website with section links and a clear workspace entry', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: spanish['landing.artLabel'] })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: spanish['nav.main'] });
    expect(navigation).toHaveTextContent(spanish['landing.productLink']);
    expect(navigation).toHaveTextContent(spanish['landing.flowLink']);
    expect(navigation).toHaveTextContent(spanish['landing.primaryAction']);
    expect(screen.getByRole('link', { name: spanish['shell.signIn'] })).toBeInTheDocument();
  });
});
