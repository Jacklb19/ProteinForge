import { describe, expect, it, vi } from 'vitest';
import {
  CreateProjectRequestSchema, CreateProjectResponseSchema, DeleteProjectRequestSchema, DeleteProjectResponseSchema,
  GetProjectResponseSchema, ListProjectsRequestSchema, ListProjectsResponseSchema, ProjectOrder, ProjectStatus, UpdateProjectRequestSchema, UpdateProjectResponseSchema,
} from '../../gen/proteinforge/project/v1/project_service_pb';
import { AlignmentMode, SubstitutionMatrix } from '../../gen/proteinforge/project/v1/workspace_pb';
import { timestampFromIso } from '../api/timestamps';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { PROJECT_PAGE_SIZE } from './config';
import { createProjectApi } from './projectApi';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const SERVICE = 'https://api.example/proteinforge.project.v1.ProjectService';
const UPDATED = '2026-10-12T08:00:00.123456Z';
const payload = { name: 'Study', activeSequence: 'ACD', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, alignment: { first: 'ACD', second: 'ACD', matrix: 'BLOSUM62', mode: 'global', result: null } } } as const;
const summary = { id: '00000000-0000-4000-8000-000000000010', name: 'Study', status: ProjectStatus.DRAFT, createTime: timestampFromIso(UPDATED), updateTime: timestampFromIso(UPDATED) };
const message = { summary, activeSequence: 'ACD', workspace: { schemaVersion: 1, profileWindow: 9, alignment: { first: 'ACD', second: 'ACD', matrix: SubstitutionMatrix.BLOSUM62, mode: AlignmentMode.GLOBAL } } };

function body(fetcher: ReturnType<typeof vi.fn<Fetcher>>, call: number) {
  return fetcher.mock.calls[call]?.[1]?.body as Uint8Array;
}

describe('project transport', () => {
  it('requests global search/order and distinguishes a saved zero from missing scientific evidence', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(ListProjectsResponseSchema, { queryApplied: true, projects: [{ ...summary, preview: {
      sequenceLength: 3, sequencePrefix: 'ACD', excluded: 0,
      descriptors: { massDa: 307, isoelectricPoint: 5, instabilityIndex: 1, aliphaticIndex: 1, gravy: 0, length: 3 },
      alignment: { firstLength: 3, secondLength: 3, firstPrefix: 'ACD', secondPrefix: 'ACE', matrix: SubstitutionMatrix.BLOSUM62, mode: AlignmentMode.GLOBAL },
    } }] }));
    const listing = await createProjectApi('https://api.example', fetcher).list('user-token', '', undefined, { query: ' Study ', order: 'name' });
    expect(grpcWebRequest(ListProjectsRequestSchema, body(fetcher, 0))).toMatchObject({ query: 'Study', order: ProjectOrder.NAME });
    expect(listing.items[0]?.preview?.descriptors?.gravy).toBe(0);
    expect(listing.items[0]?.preview?.alignment?.result).toBeNull();
    expect(listing.items[0]?.preview?.source).toBeNull();
  });
  it('does not present a legacy unfiltered response as a successful global search', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(ListProjectsResponseSchema, { projects: [summary] }));
    await expect(createProjectApi('https://api.example', fetcher).list('user-token', '', undefined, { query: 'missing', order: 'recent' })).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('rejects prefixes that exceed the declared sequence and inconsistent conservation counts', async () => {
    for (const preview of [
      { sequenceLength: 3, sequencePrefix: 'ACDE', excluded: 0 },
      { sequenceLength: 0, excluded: 0, alignment: { firstLength: 3, secondLength: 3, firstPrefix: 'ACD', secondPrefix: 'ACE', matrix: SubstitutionMatrix.BLOSUM62, mode: AlignmentMode.GLOBAL, result: { identities: 3, similarities: 2, columns: 3 } } },
    ]) {
      const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(ListProjectsResponseSchema, { projects: [{ ...summary, preview }] }));
      await expect(createProjectApi('https://api.example', fetcher).list('user-token')).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });
  it('uses bearer requests, preserves microseconds, and sends the expected revision on update/delete', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(CreateProjectResponseSchema, { project: message }))
      .mockResolvedValueOnce(grpcWebResponse(UpdateProjectResponseSchema, { project: message }))
      .mockResolvedValueOnce(grpcWebResponse(DeleteProjectResponseSchema, {}));
    const api = createProjectApi('https://api.example', fetcher);
    const saved = await api.save(payload, 'user-token');
    expect(saved).toMatchObject({ id: summary.id, status: 'draft', updatedAt: UPDATED, workspace: { alignment: { matrix: 'BLOSUM62', mode: 'global', result: null }, source: null, descriptors: null } });
    await api.save(payload, 'user-token', saved);
    await api.remove(saved.id, saved.updatedAt, 'user-token');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([`${SERVICE}/CreateProject`, `${SERVICE}/UpdateProject`, `${SERVICE}/DeleteProject`]);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error' });
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer user-token');
    const created = grpcWebRequest(CreateProjectRequestSchema, body(fetcher, 0));
    expect(created.workspace?.alignment?.matrix).toBe(SubstitutionMatrix.BLOSUM62);
    const update = grpcWebRequest(UpdateProjectRequestSchema, body(fetcher, 1));
    expect(update.expectedUpdateTime?.nanos).toBe(123_456_000);
    expect(grpcWebRequest(DeleteProjectRequestSchema, body(fetcher, 2)).expectedUpdateTime?.nanos).toBe(123_456_000);
  });

  it('pages with opaque tokens', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(ListProjectsResponseSchema, { projects: [summary], nextPageToken: 'next' }))
      .mockResolvedValueOnce(grpcWebResponse(ListProjectsResponseSchema, { projects: [] }));
    const api = createProjectApi('https://api.example', fetcher);
    expect(await api.list('user-token')).toMatchObject({ items: [{ id: summary.id, updatedAt: UPDATED }], nextPageToken: 'next' });
    expect(await api.list('user-token', 'next')).toEqual({ items: [], nextPageToken: null });
    expect(grpcWebRequest(ListProjectsRequestSchema, body(fetcher, 0))).toMatchObject({ pageSize: PROJECT_PAGE_SIZE, pageToken: '' });
    expect(grpcWebRequest(ListProjectsRequestSchema, body(fetcher, 1)).pageToken).toBe('next');
  });

  it('separates schema unavailability and conflict from successful persistence', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebError(GRPC_CODES.failedPrecondition, 'projects-schema-unavailable'))
      .mockResolvedValueOnce(grpcWebError(GRPC_CODES.aborted, 'project-conflict'))
      .mockResolvedValueOnce(grpcWebResponse(GetProjectResponseSchema, { project: { ...message, workspace: { schemaVersion: 99 } } }));
    const api = createProjectApi('https://api.example', fetcher);
    await expect(api.list('user-token')).rejects.toMatchObject({ code: 'schema' });
    await expect(api.save(payload, 'user-token', { id: summary.id, updatedAt: UPDATED })).rejects.toMatchObject({ code: 'conflict', message: 'conflict' });
    await expect(api.open(summary.id, 'user-token')).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(api.remove(summary.id, UPDATED, '')).rejects.toMatchObject({ code: 'session' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
