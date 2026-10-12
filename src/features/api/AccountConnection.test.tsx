import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider';
import { AccountConnection } from './AccountConnection';
import { SESSION_STORAGE_KEY } from '../auth/config';
import { spanish } from '../../i18n/es';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.removeItem(SESSION_STORAGE_KEY); });

describe('account connection', () => {
  it('makes no request without an explicit API URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<AuthProvider settings={null}><AccountConnection /></AuthProvider>);
    expect(screen.getByText(spanish['connection.disabled'])).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('shows a recoverable failure and retries the health contract', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(Response.json({ status: 'ok', version: '0.1.0', identity: false }));
    vi.stubGlobal('fetch', fetcher);
    render(<AuthProvider settings={null}><AccountConnection /></AuthProvider>);
    expect(await screen.findByText(spanish['connection.network'])).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish['connection.retry'] }));
    expect(await screen.findByText(spanish['connection.identityMissing'])).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('requires /me to match the signed-in identity before declaring the account connected', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: 'signed-in-user', email: 'test@example.com' } }));
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ status: 'ok', version: '0.1.0', identity: true })).mockResolvedValueOnce(Response.json({ id: 'different-user', email: 'test@example.com' }));
    vi.stubGlobal('fetch', fetcher);
    render(<AuthProvider settings={{ url: 'https://project.example.com', anonKey: 'test-public-key' }}><AccountConnection /></AuthProvider>);
    expect(await screen.findByText(spanish['connection.session'])).toBeInTheDocument();
    expect(screen.queryByText(spanish['connection.verified'])).not.toBeInTheDocument();
  });
});
