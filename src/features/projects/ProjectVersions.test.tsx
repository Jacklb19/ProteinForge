import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ListProjectVersionsRequestSchema, ListProjectVersionsResponseSchema, ProjectStatus, RestoreProjectVersionRequestSchema, RestoreProjectVersionResponseSchema,
} from '../../gen/proteinforge/project/v1/project_service_pb';
import { AlignmentMode, SubstitutionMatrix } from '../../gen/proteinforge/project/v1/workspace_pb';
import { timestampFromIso } from '../api/timestamps';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { AuthContext } from '../auth/authContext';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { AlignmentDraftProvider } from '../alignment/AlignmentDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { signedInFixture } from '../../test/authFixture';
import { PROJECT_VERSION_LIMIT } from './config';
import type { Project, ProjectVersion } from './contracts';
import { createProjectApi } from './projectApi';
import type { ProjectApi } from './projectApi';
import { ProjectProvider } from './ProjectProvider';
import { useProjects } from './projectContext';
import { ProjectVersions } from './ProjectVersions';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const ID = '00000000-0000-4000-8000-000000000010';
const VERSION = '00000000-0000-4000-8000-000000000020';
const UPDATED = '2026-11-02T08:00:00.123456Z';
const SAVED = '2026-11-01T09:30:00.5Z';
const workspace = { schemaVersion: 1 as const, profileWindow: 9 as const, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62' as const, mode: 'global' as const, result: null } };
const project: Project = { id: ID, name: 'Study', activeSequence: 'ACDE', status: 'draft', createdAt: UPDATED, updatedAt: UPDATED, workspace };
const restored: Project = { ...project, activeSequence: 'ACD', updatedAt: '2026-11-02T10:00:00.25Z' };
const version: ProjectVersion = { id: VERSION, savedAt: SAVED, preview: { sequenceLength: 3, sequencePrefix: 'ACD', excluded: 0, descriptors: null, source: null, alignment: null } };

describe('version transport', () => {
  it('lists compact previews and restores with both ids and the expected update time', async () => {
    const summary = { id: ID, name: 'Study', status: ProjectStatus.DRAFT, createTime: timestampFromIso(UPDATED), updateTime: timestampFromIso(restored.updatedAt) };
    const fetcher = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(ListProjectVersionsResponseSchema, { versions: [{ id: VERSION, saveTime: timestampFromIso(SAVED), preview: { sequenceLength: 3, sequencePrefix: 'ACD', excluded: 0 } }] }))
      .mockResolvedValueOnce(grpcWebResponse(RestoreProjectVersionResponseSchema, { project: { summary, activeSequence: 'ACD', workspace: { schemaVersion: 1, profileWindow: 9, alignment: { matrix: SubstitutionMatrix.BLOSUM62, mode: AlignmentMode.GLOBAL } } } }));
    const api = createProjectApi('https://api.example', fetcher);
    const listed = await api.versions(ID, 'user-token');
    expect(listed).toEqual([{ id: VERSION, savedAt: '2026-11-01T09:30:00.5Z', preview: { sequenceLength: 3, sequencePrefix: 'ACD', excluded: 0, hasLaboratory: false, laboratoryVariants: 0, generatorRuns: 0, descriptors: null, source: null, alignment: null } }]);
    expect(grpcWebRequest(ListProjectVersionsRequestSchema, fetcher.mock.calls[0]?.[1]?.body as Uint8Array).projectId).toBe(ID);
    const back = await api.restore(ID, VERSION, UPDATED, 'user-token');
    expect(back.activeSequence).toBe('ACD');
    const sent = grpcWebRequest(RestoreProjectVersionRequestSchema, fetcher.mock.calls[1]?.[1]?.body as Uint8Array);
    expect([sent.projectId, sent.versionId]).toEqual([ID, VERSION]);
    expect(sent.expectedUpdateTime).toEqual(timestampFromIso(UPDATED));
  });

  it('refuses more versions than the API keeps and maps a missing version to not found', async () => {
    const many = Array.from({ length: PROJECT_VERSION_LIMIT + 1 }, (_, index) => ({ id: `00000000-0000-4000-8000-0000000000${String(30 + index)}`, saveTime: timestampFromIso(SAVED) }));
    const api = createProjectApi('https://api.example', vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(ListProjectVersionsResponseSchema, { versions: many }))
      .mockResolvedValueOnce(grpcWebError(GRPC_CODES.notFound, 'project-version-not-found')));
    await expect(api.versions(ID, 'user-token')).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(api.restore(ID, VERSION, UPDATED, 'user-token')).rejects.toMatchObject({ code: 'not-found' });
  });
});

function Probe(): React.JSX.Element {
  const projects = useProjects();
  const sequence = useSequenceDraft();
  return <>
    <output data-testid="sequence">{sequence.text}</output>
    <output data-testid="notice">{projects.notice ?? ''}</output>
    <button onClick={() => { void projects.open(ID); }}>open</button>
    {projects.items.map(item => <ProjectVersions key={item.id} project={item} active={item.id === projects.active?.id} dirty={projects.dirty} offline={projects.connection === 'offline'} />)}
  </>;
}
function service(changes: Partial<ProjectApi> = {}): ProjectApi {
  return {
    list: vi.fn<ProjectApi['list']>().mockResolvedValue({ items: [project], nextPageToken: null }),
    open: vi.fn<ProjectApi['open']>().mockResolvedValue(project), save: vi.fn<ProjectApi['save']>(), remove: vi.fn<ProjectApi['remove']>(),
    versions: vi.fn<NonNullable<ProjectApi['versions']>>().mockResolvedValue([version]),
    restore: vi.fn<NonNullable<ProjectApi['restore']>>().mockResolvedValue(restored),
    ...changes,
  };
}
async function mount(api: ProjectApi): Promise<void> {
  render(<AuthContext.Provider value={signedInFixture}><SequenceDraftProvider><AlignmentDraftProvider><ProjectProvider api={api} live={null}><Probe /></ProjectProvider></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider>);
  await screen.findByText('Versiones anteriores');
}

describe('ProjectVersions', () => {
  it('reads the versions only when the list is opened', async () => {
    const api = service();
    await mount(api);
    expect(api.versions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Versiones anteriores'));
    const list = await screen.findByRole('list', { name: 'Versiones anteriores de «Study»' });
    expect(within(list).getByText(/Guardada el/)).toBeInTheDocument();
    expect(within(list).getByText('3 residuos')).toBeInTheDocument();
    expect(api.versions).toHaveBeenCalledWith(ID, 'owner-token');
  });

  it('confirms, restores and loads the restored content into the project open in Analyze', async () => {
    const api = service();
    await mount(api);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => { expect(screen.getByTestId('sequence')).toHaveTextContent('ACDE'); });
    fireEvent.click(screen.getByText('Versiones anteriores'));
    fireEvent.click(await screen.findByRole('button', { name: /Restaurar la versión guardada el/ }));
    expect(screen.getByRole('group', { name: /¿Restaurar la versión del/ })).toBeInTheDocument();
    expect(api.restore).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restaurar' })); await Promise.resolve(); });
    await waitFor(() => { expect(screen.getByTestId('notice')).toHaveTextContent('restored'); });
    expect(api.restore).toHaveBeenCalledWith(ID, VERSION, UPDATED, 'owner-token', expect.any(AbortSignal));
    expect(screen.getByTestId('sequence')).toHaveTextContent(/^ACD$/);
  });

  it('says when there is nothing yet, and names a failure in its own words', async () => {
    await mount(service({ versions: vi.fn<NonNullable<ProjectApi['versions']>>().mockResolvedValue([]) }));
    fireEvent.click(screen.getByText('Versiones anteriores'));
    expect(await screen.findByText(/Todavía no hay versiones anteriores/)).toBeInTheDocument();
  });

  it('answers that versions are unavailable on an API without them', async () => {
    await mount(service({ versions: undefined, restore: undefined }));
    fireEvent.click(screen.getByText('Versiones anteriores'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
