import { ProjectOrder, ProjectService } from '../../gen/proteinforge/project/v1/project_service_pb';
import { ApiError, validated } from '../api/apiClient';
import { callOptions, createRpcClient, rpc } from '../api/rpc';
import { timestampFromIso } from '../api/timestamps';
import { DEFAULT_PROJECT_QUERY, PROJECT_PAGE_SIZE } from './config';
import type { ProjectQuery } from './config';
import { projectListSchema, projectSchema } from './contracts';
import type { Project, ProjectWrite } from './contracts';
import { projectDocument, summaryDocument, workspaceMessage } from './rpcMapping';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Owner projects through ProjectService; the server identifies the owner from the session token. */
export function createProjectApi(baseUrl: string, fetchImplementation?: FetchLike) {
  const client = createRpcClient(ProjectService, baseUrl, fetchImplementation);
  function session(token: string): string {
    if (!token.trim()) throw new ApiError('session');
    return token;
  }
  // Arrow properties: callers pass these operations around without binding.
  return {
    list: async (token: string, pageToken = '', signal?: AbortSignal, listing: ProjectQuery = DEFAULT_PROJECT_QUERY) => {
      const response = await rpc(() => client.listProjects({ pageSize: PROJECT_PAGE_SIZE, pageToken, query: listing.query.trim(), order: listing.order === 'name' ? ProjectOrder.NAME : ProjectOrder.RECENT }, callOptions(signal, session(token))));
      if ((listing.query.trim() || listing.order !== DEFAULT_PROJECT_QUERY.order) && !response.queryApplied) throw new ApiError('unavailable');
      return validated(projectListSchema, { items: response.projects.map(summaryDocument), nextPageToken: response.nextPageToken || null });
    },
    open: async (id: string, token: string, signal?: AbortSignal): Promise<Project> => {
      const response = await rpc(() => client.getProject({ id }, callOptions(signal, session(token))));
      return validated(projectSchema, projectDocument(response.project));
    },
    save: async (payload: ProjectWrite, token: string, active?: { id: string; updatedAt: string }, signal?: AbortSignal): Promise<Project> => {
      const options = callOptions(signal, session(token));
      const fields = { name: payload.name, activeSequence: payload.activeSequence, workspace: workspaceMessage(payload.workspace) };
      const { project } = await rpc(async () => active
        ? client.updateProject({ ...fields, id: active.id, expectedUpdateTime: timestampFromIso(active.updatedAt) }, options)
        : client.createProject(fields, options));
      return validated(projectSchema, projectDocument(project));
    },
    remove: async (id: string, updatedAt: string, token: string, signal?: AbortSignal): Promise<void> => {
      await rpc(() => client.deleteProject({ id, expectedUpdateTime: timestampFromIso(updatedAt) }, callOptions(signal, session(token))));
    },
  };
}
export type ProjectApi = ReturnType<typeof createProjectApi>;
