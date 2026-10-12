import { describe, expect, it, vi } from 'vitest';
import { createProjectApi } from './projectApi';
import { PROJECT_ENDPOINT } from './config';

const payload = { name: 'Study', activeSequence: 'ACD', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } } as const;
const stored = { ...payload, id: '00000000-0000-4000-8000-000000000010', status: 'draft', createdAt: '2026-10-12T08:00:00.123456+00:00', updatedAt: '2026-10-12T08:00:00.123456+00:00' };
describe('project transport', () => {
  it('uses bearer requests, preserves microseconds, and sends the expected revision on update/delete', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(stored)).mockResolvedValueOnce(Response.json(stored)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createProjectApi('https://api.example', fetcher);
    expect((await api.save(payload, 'user-token')).updatedAt).toBe(stored.updatedAt);
    await api.save(payload, 'user-token', stored);
    await api.remove(stored.id, stored.updatedAt, 'user-token');
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.example${PROJECT_ENDPOINT}`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer user-token' } });
    const body = fetcher.mock.calls[1]?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Missing JSON request body');
    expect(JSON.parse(body)).toMatchObject({ expectedUpdatedAt: stored.updatedAt });
    expect(fetcher.mock.calls[2]?.[0]).toEqual(expect.stringContaining(encodeURIComponent(stored.updatedAt)));
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe('DELETE');
  });
  it('separates schema unavailability and conflict from successful persistence', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ type: 'https://proteinforge.invalid/problems/projects-schema-unavailable' }, { status: 503 })).mockResolvedValueOnce(Response.json({ detail: 'private data' }, { status: 409 })).mockResolvedValueOnce(Response.json({ ...stored, workspace: { schemaVersion: 99 } }));
    const api = createProjectApi('https://api.example', fetcher);
    await expect(api.list('user-token')).rejects.toMatchObject({ code: 'schema' });
    await expect(api.save(payload, 'user-token', stored)).rejects.toMatchObject({ code: 'conflict', message: 'conflict' });
    await expect(api.open(stored.id, 'user-token')).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(api.remove(stored.id, stored.updatedAt, '')).rejects.toMatchObject({ code: 'session' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
