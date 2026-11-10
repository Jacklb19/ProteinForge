import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n';
import { translate } from '../../i18n/translate';
import type { TranslationKey } from '../../i18n';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { ProjectContext } from './projectContext';
import type { ProjectContextValue } from './projectContext';
import { DEFAULT_PROJECT_QUERY } from './config';
import type { Project } from './contracts';
import type { SyncEntry } from './syncQueue';
import { SyncQueued, SyncStatus } from './ProjectSync';
import { ProjectLibrary } from './ProjectLibrary';
import { ProfilePage } from '../profile/ProfilePage';
import { PreferencesProvider } from '../../preferences/PreferencesProvider';

const t = (key: TranslationKey, variables: Record<string, string | number> = {}): string => translate('es', key, variables);
const stored: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Insulina humana', activeSequence: 'ACD', status: 'draft', createdAt: '2026-11-02T08:00:00Z', updatedAt: '2026-11-02T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 19, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
const anonymous: AuthContextValue = { ...signedInFixture, status: 'anonymous', session: null };

function entry(changes: Partial<SyncEntry> = {}): SyncEntry {
  return {
    key: stored.id, owner: 'owner', email: 'a@example.org', projectId: stored.id, requestId: 'request', name: stored.name, kind: 'analysis', base: stored,
    write: { name: stored.name, activeSequence: 'ACDEF', workspace: { ...stored.workspace, profileWindow: 9 } }, runs: [], changedAt: Date.now(), state: 'pending',
    attempts: 0, retryAt: 0, error: null, uncertain: false, remote: null, saved: null, savedAt: null, laboratory: null, ...changes,
  };
}
function projects(changes: Partial<ProjectContextValue> = {}): ProjectContextValue {
  return {
    enabled: true, active: null, laboratory: null, items: [stored], nextPageToken: null, dirty: false, busy: false, error: null, notice: null, attempt: 0, listing: DEFAULT_PROJECT_QUERY,
    remoteChange: null, connection: 'online', pending: [], syncing: false, queuedAnalysis: null, queuedLaboratory: null,
    retry: vi.fn(), discard: vi.fn(), discardAll: vi.fn(), clearSaved: vi.fn(), resolve: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn(), open: vi.fn(), saveLaboratory: vi.fn(), save: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn(), detach: vi.fn(),
    saveGeneratorRun: vi.fn(), removeGeneratorRun: vi.fn(), searchProject: null, chooseSearchProject: vi.fn(), createSearchProject: vi.fn(), ...changes,
  };
}
function mount(element: React.JSX.Element, value: ProjectContextValue, auth: AuthContextValue = signedInFixture) {
  return render(<MemoryRouter><PreferencesProvider><LocaleProvider locale="es"><AuthContext.Provider value={auth}><SequenceDraftProvider><AlignmentDraftProvider>
    <ProjectContext.Provider value={value}>{element}</ProjectContext.Provider>
  </AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider></LocaleProvider></PreferencesProvider></MemoryRouter>);
}

describe('sidebar status', () => {
  it.each([
    ['offline with a save waiting', projects({ connection: 'offline', pending: [entry()] }), signedInFixture, [t('sync.offline'), `${t('sync.pendingOne')} ${t('sync.keepTabOpen')}`]],
    ['saving', projects({ syncing: true, pending: [entry({ state: 'saved' }), entry({ key: 'b', projectId: 'b', state: 'saving' }), entry({ key: 'c', projectId: 'c' })] }), signedInFixture, [t('sync.saving', { current: 2, total: 3 })]],
    ['attention', projects({ pending: [entry({ state: 'saved' }), entry({ key: 'b', state: 'conflict' }), entry({ key: 'c', state: 'failed' })] }), signedInFixture, [t('sync.attentionMany', { count: 2 }), t('sync.attentionHelp', { saved: 1 })]],
    ['session ended', projects({ pending: [entry()] }), anonymous, [t('sync.sessionEnded'), t('sync.sessionEndedHelpOne', { email: 'a@example.org', count: 1 })]],
    ['another account', projects({ pending: [entry({ owner: 'someone-else' })] }), signedInFixture, [t('sync.otherAccount')]],
  ] as const)('says %s in one status', (_name, value, auth, texts) => {
    mount(<SyncStatus />, value, auth);
    const status = screen.getByRole('status');
    for (const text of texts) expect(status).toHaveTextContent(text);
  });

  it('shows the saving progress with its name, and nothing when everything is saved and online', () => {
    const view = mount(<SyncStatus />, projects({ syncing: true, pending: [entry({ state: 'saving' })] }));
    expect(screen.getByRole('progressbar', { name: t('sync.progressLabel') })).toBeInTheDocument();
    view.unmount();
    mount(<SyncStatus />, projects({ pending: [entry({ state: 'saved' })] }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lets another account discard what it cannot send', async () => {
    const discardAll = vi.fn();
    mount(<SyncStatus />, projects({ pending: [entry({ owner: 'someone-else' })], discardAll }));
    await userEvent.click(screen.getByRole('button', { name: t('sync.discard') }));
    expect(discardAll).toHaveBeenCalledWith('others');
  });
});

describe('save panel', () => {
  it('says the save waits, and lets it be discarded', async () => {
    const discard = vi.fn();
    mount(<SyncQueued entry={entry()} />, projects({ discard }));
    expect(screen.getByRole('status')).toHaveTextContent(`${t('sync.queued', { name: stored.name })} ${t('sync.queuedHelp')}`);
    await userEvent.click(screen.getByRole('button', { name: t('sync.discardQueued') }));
    expect(discard).toHaveBeenCalledWith(stored.id);
  });

  it('asks for the same account when the session ended offline', () => {
    mount(<SyncQueued entry={entry()} />, projects(), anonymous);
    expect(screen.getByRole('status')).toHaveTextContent(t('sync.sessionEndedPanel'));
    expect(screen.getByRole('link', { name: t('shell.signIn') })).toHaveAttribute('href', '/sign-in');
  });
});

describe('project rows', () => {
  it('locks search, sorting and the row menu offline but keeps the open list', () => {
    mount(<ProjectLibrary />, projects({ connection: 'offline', pending: [entry()] }));
    expect(screen.getByRole('searchbox')).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText(t('sync.searchOffline'))).toBeVisible();
    const row = screen.getByRole('article', { name: stored.name });
    expect(within(row).getByText(t('sync.rowChanges', { time: t('projects.justNow') }))).toBeVisible();
    for (const action of ['rename', 'duplicate', 'delete'] as const) expect(within(row).getByRole('button', { name: t(`projects.${action}Named`, { name: stored.name }), hidden: true })).toBeDisabled();
  });

  it('shows a project created offline before it exists in the account', () => {
    mount(<ProjectLibrary />, projects({ connection: 'offline', pending: [entry({ key: 'new:request', projectId: null, base: null, name: 'Glucagón humano' })] }));
    const row = screen.getByRole('article', { name: 'Glucagón humano' });
    expect(within(row).getByText(t('sync.rowNew'))).toBeVisible();
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers discard and retry after a failure, with the reason', async () => {
    const retry = vi.fn(), discard = vi.fn();
    mount(<ProjectLibrary />, projects({ pending: [entry({ state: 'failed', error: 'validation' })], retry, discard }));
    const row = screen.getByRole('article', { name: stored.name });
    expect(within(row).getByText(t('sync.failed'))).toBeVisible();
    expect(within(row).getByText(t('projects.validation'))).toBeVisible();
    await userEvent.click(within(row).getByRole('button', { name: t('sync.retry') }));
    await userEvent.click(within(row).getByRole('button', { name: t('sync.discard') }));
    expect(retry).toHaveBeenCalledWith(stored.id);
    expect(discard).toHaveBeenCalledWith(stored.id);
  });

  it('settles a conflict inside the row: both versions, focus on the question, and keep both as a copy', async () => {
    const remote = { ...stored, activeSequence: 'ACDW', updatedAt: new Date().toISOString() };
    const resolve = vi.fn().mockResolvedValue(undefined);
    mount(<ProjectLibrary />, projects({ pending: [entry({ state: 'conflict', remote }), entry({ key: 'saved', projectId: 'other', state: 'saved', name: 'Glucagón humano' })], resolve }));
    expect(screen.getByText(t('sync.savedSomeOne', { name: 'Glucagón humano', count: 1 }))).toBeVisible();
    const row = screen.getByRole('article', { name: stored.name });
    const choose = within(row).getByRole('button', { name: t('sync.chooseVersion') });
    expect(choose).toHaveAttribute('aria-expanded', 'false');
    const controlled = choose.getAttribute('aria-controls');
    await userEvent.click(choose);
    const section = within(row).getByRole('region', { name: t('sync.conflictTitle') });
    expect(section.id).toBe(controlled);
    expect(within(section).getByText(t('sync.conflictTitle'))).toHaveFocus();
    expect(section).toHaveTextContent(t('fasta.residues', { count: 5 }));
    expect(section).toHaveTextContent(t('fasta.residues', { count: 4 }));
    expect(section).toHaveTextContent(t('sync.profileWindow', { count: 9 }));
    expect(section).toHaveTextContent(t('sync.profileWindow', { count: 19 }));
    const copy = t('projects.copyName', { name: stored.name });
    expect(section).toHaveTextContent(t('sync.keepHelp', { copy }));
    const buttons = within(section).getAllByRole('button').map(button => button.textContent);
    expect(buttons).toEqual([t('sync.keepBoth'), t('sync.keepMine'), t('sync.keepTheirs')]);
    await userEvent.click(within(section).getByRole('button', { name: t('sync.keepBoth') }));
    expect(resolve).toHaveBeenCalledWith(stored.id, 'both', copy);
  });
});

describe('signing out', () => {
  it('asks first when saves are waiting, and discards them only on confirmation', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const discardAll = vi.fn();
    mount(<ProfilePage />, projects({ pending: [entry()], discardAll }), { ...signedInFixture, signOut });
    await userEvent.click(screen.getByRole('button', { name: t('settings.signOut') }));
    expect(signOut).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: t('settings.signOut') });
    expect(confirm).toHaveTextContent(t('sync.signOutPendingOne', { count: 1 }));
    await userEvent.click(within(confirm).getByRole('button', { name: t('projects.cancel') }));
    expect(screen.queryByRole('group', { name: t('settings.signOut') })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('settings.signOut') }));
    await userEvent.click(within(screen.getByRole('group', { name: t('settings.signOut') })).getByRole('button', { name: t('settings.signOut') }));
    expect(discardAll).toHaveBeenCalledWith('mine');
    expect(signOut).toHaveBeenCalled();
  });

  it('signs out at once with nothing waiting', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mount(<ProfilePage />, projects(), { ...signedInFixture, signOut });
    await userEvent.click(screen.getByRole('button', { name: t('settings.signOut') }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('review fixes', () => {
  it('says the other account apart and still shows this account\'s own waiting saves', () => {
    mount(<SyncStatus />, projects({ connection: 'offline', pending: [entry({ owner: 'someone-else' }), entry({ key: 'mine' })] }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(t('sync.otherAccount'));
    expect(status).toHaveTextContent(t('sync.offline'));
    expect(status).toHaveTextContent(t('sync.pendingOne'));
  });

  it('moves relative times on while the row stays on screen', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      mount(<ProjectLibrary />, projects({ connection: 'offline', pending: [entry()] }));
      const row = screen.getByRole('article', { name: stored.name });
      expect(within(row).getByText(t('sync.rowChanges', { time: t('projects.justNow') }))).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(3 * 60_000); });
      expect(within(row).queryByText(t('sync.rowChanges', { time: t('projects.justNow') }))).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('returns the focus to the project title after choosing a version', async () => {
    const remote = { ...stored, activeSequence: 'ACDW', updatedAt: new Date().toISOString() };
    const resolve = vi.fn().mockResolvedValue(undefined);
    mount(<ProjectLibrary />, projects({ pending: [entry({ state: 'conflict', remote })], resolve }));
    const row = screen.getByRole('article', { name: stored.name });
    await userEvent.click(within(row).getByRole('button', { name: t('sync.chooseVersion') }));
    await userEvent.click(within(row).getByRole('button', { name: t('sync.keepMine') }));
    expect(within(row).getByRole('heading', { name: stored.name })).toHaveFocus();
  });
});
