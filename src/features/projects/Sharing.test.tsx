import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CreateProjectShareResponseSchema, GetProjectShareResponseSchema, GetSharedProjectRequestSchema, GetSharedProjectResponseSchema,
} from '../../gen/proteinforge/project/v1/project_service_pb';
import { AlignmentMode, SubstitutionMatrix } from '../../gen/proteinforge/project/v1/workspace_pb';
import { timestampFromIso } from '../api/timestamps';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { ROUTES } from '../../shared/navigation';
import type { ProjectContextValue } from './projectContext';
import { ProjectContext } from './projectContext';
import type { ProjectSummary } from './contracts';
import { createProjectApi } from './projectApi';
import { createSharedApi, shareUrl, tokenFromHash } from './sharing';
import { ShareDialog } from './ShareDialog';
import { SharedPage } from './SharedPage';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const ID = '00000000-0000-4000-8000-000000000010';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_6';
const CREATED = '2026-11-10T08:00:00Z';
const EXPIRES = '2026-11-17T08:00:00Z';
const share = { createTime: timestampFromIso(CREATED), expireTime: timestampFromIso(EXPIRES) };
const shared = {
  name: 'Insulina humana', activeSequence: 'ACDEFGHIKLMNPQRSTVWYACDEFGHIKLMNPQRSTVWYACDEFGHIKLMNPQRSTVWYACDE', updateTime: timestampFromIso(CREATED), expireTime: timestampFromIso(EXPIRES),
  workspace: { schemaVersion: 1, profileWindow: 9, alignment: { matrix: SubstitutionMatrix.BLOSUM62, mode: AlignmentMode.GLOBAL } },
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('link addresses', () => {
  it('puts the token after # and reads back only a well-formed one', () => {
    expect(shareUrl(TOKEN, 'https://app.example')).toBe(`https://app.example${ROUTES.shared}#${TOKEN}`);
    expect(tokenFromHash(`#${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash('#short')).toBeNull();
    expect(tokenFromHash(`#${TOKEN}x`)).toBeNull();
    expect(tokenFromHash(`#${TOKEN.slice(0, 42)}/`)).toBeNull();
  });
});

describe('link transport', () => {
  it('creates a link with the session and opens it without one', async () => {
    const owner = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(CreateProjectShareResponseSchema, { token: TOKEN, share }))
      .mockResolvedValueOnce(grpcWebResponse(GetProjectShareResponseSchema, {}));
    const api = createProjectApi('https://api.example', owner);
    expect(await api.createShare(ID, 'user-token')).toEqual({ token: TOKEN, share: { createdAt: CREATED, expiresAt: EXPIRES } });
    expect(await api.share(ID, 'user-token')).toBeNull();
    const visitor = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(GetSharedProjectResponseSchema, { project: shared }));
    const opened = await createSharedApi('https://api.example', visitor).open(TOKEN);
    expect(opened.name).toBe('Insulina humana');
    expect(grpcWebRequest(GetSharedProjectRequestSchema, visitor.mock.calls[0]?.[1]?.body as Uint8Array).token).toBe(TOKEN);
    expect(new Headers(visitor.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
  });

  it('refuses a malformed token before any request and a snapshot carrying the laboratory', async () => {
    const visitor = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(GetSharedProjectResponseSchema, { project: { ...shared, workspace: { ...shared.workspace, schemaVersion: 3 } } }));
    const api = createSharedApi('https://api.example', visitor);
    await expect(api.open('short')).rejects.toMatchObject({ code: 'not-found' });
    expect(visitor).not.toHaveBeenCalled();
    await expect(api.open(TOKEN)).rejects.toMatchObject({ code: 'invalid-response' });
  });
});

function projects(changes: Partial<ProjectContextValue>): ProjectContextValue {
  return { share: vi.fn().mockResolvedValue(null), createShare: vi.fn(), removeShare: vi.fn(), ...changes } as unknown as ProjectContextValue;
}
const summary = { id: ID, name: 'Insulina humana', status: 'draft', createdAt: CREATED, updatedAt: CREATED } as ProjectSummary;

describe('ShareDialog', () => {
  it('shows the address once after creating it and says what a visitor sees', async () => {
    const value = projects({ createShare: vi.fn().mockResolvedValue({ token: TOKEN, share: { createdAt: CREATED, expiresAt: EXPIRES } }) });
    render(<ProjectContext.Provider value={value}><ShareDialog project={summary} onClose={vi.fn()} /></ProjectContext.Provider>);
    expect(screen.getByText(/No ve el laboratorio, las búsquedas guardadas ni tu correo/)).toBeInTheDocument();
    expect(await screen.findByText('Este proyecto no tiene enlace.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' })); await Promise.resolve(); });
    const field = await screen.findByLabelText('Enlace de solo lectura');
    expect(field).toHaveValue(`${window.location.origin}${ROUTES.shared}#${TOKEN}`);
    expect(screen.getByText(/no se vuelve a mostrar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dejar de compartir' })).toBeInTheDocument();
  });

  it('never shows an existing address, offers to replace it and ends it', async () => {
    const removeShare = vi.fn().mockResolvedValue(undefined);
    const value = projects({ share: vi.fn().mockResolvedValue({ createdAt: CREATED, expiresAt: EXPIRES }), removeShare });
    render(<ProjectContext.Provider value={value}><ShareDialog project={summary} onClose={vi.fn()} /></ProjectContext.Provider>);
    expect(await screen.findByText(/Hay un enlace activo hasta el/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Enlace de solo lectura')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear otro enlace' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Dejar de compartir' })); await Promise.resolve(); });
    expect(removeShare).toHaveBeenCalledWith(ID);
    expect(await screen.findByText('Este proyecto no tiene enlace.')).toBeInTheDocument();
  });
});

function visit(hash: string): void {
  render(<MemoryRouter initialEntries={[`${ROUTES.shared}${hash}`]}><SharedPage /></MemoryRouter>);
}

describe('SharedPage', () => {
  it('shows the saved project read-only, with the sequence in numbered lines', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example');
    vi.stubGlobal('fetch', vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(GetSharedProjectResponseSchema, { project: shared })));
    visit(`#${TOKEN}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Insulina humana' })).toBeInTheDocument();
    expect(screen.getByText(/Vista de solo lectura/)).toBeInTheDocument();
    expect(screen.getByText(/^1 ACDEFGHIKL MNPQRSTVWY ACDEFGHIKL MNPQRSTVWY ACDEFGHIKL MNPQRSTVWY 61 ACDE$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secuencia FASTA' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', ROUTES.signUp);
    expect(screen.queryByRole('heading', { name: 'Comparación guardada' })).not.toBeInTheDocument();
  });

  it('says the same for a missing, revoked or malformed link', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example');
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebError(GRPC_CODES.notFound, 'shared-not-found'));
    vi.stubGlobal('fetch', fetcher);
    visit(`#${TOKEN}`);
    expect(await screen.findByRole('heading', { name: 'Este enlace no abre ningún proyecto' })).toBeInTheDocument();
    expect(screen.getByText(/haber caducado/)).toBeInTheDocument();
  });

  it('does not ask the API for a malformed link', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example');
    const fetcher = vi.fn<Fetcher>();
    vi.stubGlobal('fetch', fetcher);
    visit('#nope');
    await waitFor(() => { expect(screen.getByRole('heading', { name: 'Este enlace no abre ningún proyecto' })).toBeInTheDocument(); });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
