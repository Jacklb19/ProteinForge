import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n';
import { RouteBoundary } from './RouteBoundary';
import { spanish } from '../i18n/es';
import { english } from '../i18n/en';

function Broken(): React.JSX.Element { throw new Error('chunk unavailable'); }

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });

it('states that a screen could not be shown instead of leaving the page empty', () => {
  render(<LocaleProvider locale="es"><RouteBoundary><Broken /></RouteBoundary></LocaleProvider>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(spanish['shell.screenFailed']);
  expect(screen.getByRole('button', { name: spanish['shell.reload'] })).toBeVisible();
  expect(console.error).toHaveBeenCalled();
});

it('shows a working screen again in English once the address changes', () => {
  const view = render(<LocaleProvider locale="en"><RouteBoundary key="/a"><Broken /></RouteBoundary></LocaleProvider>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(english['shell.screenFailed']);
  view.rerender(<LocaleProvider locale="en"><RouteBoundary key="/b"><p>Working</p></RouteBoundary></LocaleProvider>);
  expect(screen.getByText('Working')).toBeVisible();
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
});
