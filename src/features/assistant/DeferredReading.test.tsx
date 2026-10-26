import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { spanish } from '../../i18n/es';
import { ReadingSection } from './ReadingSection';
import type { AssistantApi, Reading } from './assistantApi';

const deferred = vi.hoisted(() => {
  let release!: () => void;
  let finish!: (reading: Reading) => void;
  const module = new Promise<void>(resolve => { release = resolve; });
  const answer = new Promise<Reading>(resolve => { finish = resolve; });
  return { release, finish, module, loaded: vi.fn(), create: vi.fn(), interpret: vi.fn<AssistantApi['interpret']>().mockReturnValue(answer) };
});
vi.mock('./assistantApi', async () => {
  deferred.loaded(); await deferred.module;
  return { createAssistantApi: deferred.create.mockReturnValue({ interpret: deferred.interpret }) };
});
afterEach(() => { vi.unstubAllEnvs(); });

it('discards an abandoned client import and a late reading across owner changes', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.e2e.invalid');
  const anonymous: AuthContextValue = { ...signedInFixture, status: 'anonymous', session: null };
  const content = (identity: AuthContextValue) => <MemoryRouter><AuthContext.Provider value={identity}>
    <ReadingSection subject="analysis" build={() => [{ label: 'Length', value: '18' }]} revision="r1" />
  </AuthContext.Provider></MemoryRouter>;
  const view = render(content(anonymous));
  expect(deferred.loaded).not.toHaveBeenCalled();
  view.rerender(content(signedInFixture));
  await waitFor(() => { expect(deferred.loaded).toHaveBeenCalledOnce(); });
  view.rerender(content(anonymous));
  await act(async () => { deferred.release(); await deferred.module; });
  expect(deferred.create).not.toHaveBeenCalled();

  const session = signedInFixture.session;
  if (!session) throw new Error('Missing fixture session.');
  const second: AuthContextValue = { ...signedInFixture, session: { ...session, accessToken: 'second-token', user: { id: 'second', email: 'second@example.org' } } };
  view.rerender(content(second));
  const read = screen.getByRole('button', { name: spanish['assistant.read.analysis'] });
  await waitFor(() => { expect(read).toBeEnabled(); });
  fireEvent.click(read);
  expect(deferred.interpret.mock.calls[0]?.[3]).toBe('second-token');
  view.rerender(content(anonymous));
  expect(deferred.interpret.mock.calls[0]?.[4]?.aborted).toBe(true);
  await act(async () => { deferred.finish({ text: 'Private reading', model: 'model', provider: 'test', createdAt: '2026-10-25T12:00:00Z' }); await Promise.resolve(); });
  view.rerender(content(second));
  expect(screen.queryByText('Private reading')).not.toBeInTheDocument();
});
