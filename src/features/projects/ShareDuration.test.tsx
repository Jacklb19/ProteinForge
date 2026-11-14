import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateProjectShareRequestSchema, CreateProjectShareResponseSchema, ListProjectsResponseSchema, ProjectStatus } from '../../gen/proteinforge/project/v1/project_service_pb';
import { timestampFromIso } from '../api/timestamps';
import { grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { LocaleProvider } from '../../i18n';
import { translate } from '../../i18n/translate';
import { MS_PER_DAY, PROJECT_SHARE_DEFAULT_DAYS, PROJECT_SHARE_DURATIONS_DAYS } from './config';
import { ProjectCard } from './ProjectCard';
import { ProjectContext } from './projectContext';
import type { ProjectContextValue } from './projectContext';
import type { ProjectSummary } from './contracts';
import { createProjectApi } from './projectApi';
import { ShareDialog } from './ShareDialog';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const ID = '00000000-0000-4000-8000-000000000010';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_6';
const NOW = new Date('2026-11-13T09:24:00Z');
const CREATED = NOW.toISOString();
const EXPIRES = '2026-11-20T09:24:00Z';
const summary: ProjectSummary = { id: ID, name: 'Insulina humana', status: 'draft', createdAt: CREATED, updatedAt: CREATED };

afterEach(() => { vi.useRealTimers(); });

describe('link duration transport', () => {
  it('sends the chosen duration, seven days by default, and reads the expiry from the listing', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockImplementation(() => Promise.resolve(grpcWebResponse(CreateProjectShareResponseSchema, { token: TOKEN, share: { createTime: timestampFromIso(CREATED), expireTime: timestampFromIso(EXPIRES) } })));
    const api = createProjectApi('https://api.example', fetcher);
    await api.createShare(ID, 'user-token', 30);
    await api.createShare(ID, 'user-token');
    const sent = fetcher.mock.calls.map(call => grpcWebRequest(CreateProjectShareRequestSchema, call[1]?.body as Uint8Array).durationDays);
    expect(sent).toEqual([30, PROJECT_SHARE_DEFAULT_DAYS]);

    const listing = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(ListProjectsResponseSchema, { queryApplied: true, projects: [
      { id: ID, name: 'Shared', status: ProjectStatus.DRAFT, createTime: timestampFromIso(CREATED), updateTime: timestampFromIso(CREATED), shareExpireTime: timestampFromIso(EXPIRES) },
      { id: '00000000-0000-4000-8000-000000000011', name: 'Private', status: ProjectStatus.DRAFT, createTime: timestampFromIso(CREATED), updateTime: timestampFromIso(CREATED) },
    ] }));
    const { items } = await createProjectApi('https://api.example', listing).list('user-token');
    expect(items.map(item => item.shareExpiresAt)).toEqual([EXPIRES, undefined]);
  });
});

describe('ShareDialog duration', () => {
  function open(createShare = vi.fn().mockResolvedValue({ token: TOKEN, share: { createdAt: CREATED, expiresAt: EXPIRES } })) {
    const value = { share: vi.fn().mockResolvedValue(null), createShare, removeShare: vi.fn() } as unknown as ProjectContextValue;
    render(<ProjectContext.Provider value={value}><ShareDialog project={summary} onClose={vi.fn()} /></ProjectContext.Provider>);
    return createShare;
  }
  // The day the link would end, in the dialog's long date; the hour depends on the test machine's zone.
  const until = (days: number): RegExp => new RegExp(`^Dejará de funcionar el ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(NOW.getTime() + days * MS_PER_DAY))}`);

  it('offers one, seven and thirty days, starts at seven and says when the link would stop working', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const createShare = open();
    expect(await screen.findByText('Este proyecto no tiene enlace.')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: translate('es', 'share.duration') });
    const options = PROJECT_SHARE_DURATIONS_DAYS.map(days => screen.getByRole('radio', { name: days === 1 ? '1 día' : `${String(days)} días` }));
    expect(group).toBeInTheDocument();
    expect(options.map(option => (option as HTMLInputElement).checked)).toEqual([false, true, false]);
    expect(screen.getByText(until(7))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '30 días' }));
    expect(screen.getByText(until(30))).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' })); await Promise.resolve(); });
    expect(createShare).toHaveBeenCalledWith(ID, 30);
  });
});

describe('ProjectCard link line', () => {
  function card(project: ProjectSummary) {
    return render(<LocaleProvider locale="es"><ProjectCard project={project} busy={false} active={false} dirty={false} onOpen={vi.fn()} onAction={vi.fn()} /></LocaleProvider>);
  }

  it('says until when an unexpired link works, and nothing without one or after it expired', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const shared = card({ ...summary, shareExpiresAt: EXPIRES });
    expect(screen.getByText(/^Compartido para leer hasta el 20 (de )?nov/)).toBeVisible();
    shared.unmount();
    const none = card(summary);
    expect(screen.queryByText(/Compartido para leer/)).not.toBeInTheDocument();
    none.unmount();
    card({ ...summary, shareExpiresAt: new Date(NOW.getTime() - 1_000).toISOString() });
    expect(screen.queryByText(/Compartido para leer/)).not.toBeInTheDocument();
  });

  it('has the same line in English', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    render(<LocaleProvider locale="en"><ProjectCard project={{ ...summary, shareExpiresAt: EXPIRES }} busy={false} active={false} dirty={false} onOpen={vi.fn()} onAction={vi.fn()} /></LocaleProvider>);
    expect(screen.getByText(/^Shared to read until /)).toBeVisible();
  });
});
