import { ApiError, createApiTransport } from '../api/apiClient';
import { PROJECT_ENDPOINT, PROJECT_PAGE_SIZE } from './config';
import { projectListSchema, projectSchema } from './contracts';
import type { ProjectWrite } from './contracts';
import type { z } from 'zod';

export function createProjectApi(baseUrl: string, fetchImplementation: typeof fetch = fetch) {
  const request = createApiTransport(baseUrl, fetchImplementation);
  async function validated<T>(schema: z.ZodType<T>, path: string, token: string, signal?: AbortSignal, options?: { method?: string; body?: unknown }): Promise<T> {
    if (!token.trim()) throw new ApiError('session');
    const parsed = schema.safeParse(await request(path, signal, token, options));
    if (!parsed.success) throw new ApiError('invalid-response');
    return parsed.data;
  }
  return {
    list: (token: string, offset = 0, signal?: AbortSignal) => validated(projectListSchema, `${PROJECT_ENDPOINT}?limit=${String(PROJECT_PAGE_SIZE)}&offset=${String(offset)}`, token, signal),
    open: (id: string, token: string, signal?: AbortSignal) => validated(projectSchema, `${PROJECT_ENDPOINT}/${encodeURIComponent(id)}`, token, signal),
    save: (payload: ProjectWrite, token: string, active?: { id: string; updatedAt: string }, signal?: AbortSignal) => validated(projectSchema, active ? `${PROJECT_ENDPOINT}/${encodeURIComponent(active.id)}` : PROJECT_ENDPOINT, token, signal, { method: active ? 'PUT' : 'POST', body: active ? { ...payload, expectedUpdatedAt: active.updatedAt } : payload }),
    async remove(id: string, updatedAt: string, token: string, signal?: AbortSignal): Promise<void> {
      if (!token.trim()) throw new ApiError('session');
      await request(`${PROJECT_ENDPOINT}/${encodeURIComponent(id)}?expectedUpdatedAt=${encodeURIComponent(updatedAt)}`, signal, token, { method: 'DELETE' });
    },
  };
}
export type ProjectApi = ReturnType<typeof createProjectApi>;
