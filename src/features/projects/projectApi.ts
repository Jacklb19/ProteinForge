import { ProjectOrder, ProjectService, CreateProjectRequestSchema, UpdateProjectRequestSchema } from '../../gen/proteinforge/project/v1/project_service_pb';
import { create, toBinary } from '@bufbuild/protobuf';
import { ApiError, validated } from '../api/apiClient';
import { callOptions, createRpcClient, rpc } from '../api/rpc';
import { timestampFromIso } from '../api/timestamps';
import { DEFAULT_PROJECT_QUERY, PROJECT_PAGE_SIZE } from './config';
import type { ProjectQuery } from './config';
import { projectListSchema, projectSchema, projectVersionListSchema } from './contracts';
import type { Project, ProjectVersion, ProjectWrite } from './contracts';
import { projectDocument, summaryDocument, versionDocument, workspaceMessage } from './rpcMapping';
import { createdShareSchema, projectShareSchema, shareDocument } from './sharing';
import type { CreatedShare, ProjectShare } from './sharing';

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
    /** `requestId` makes a create idempotent on an API that supports it; updates are guarded by their version instead. */
    save: async (payload: ProjectWrite, token: string, active?: { id: string; updatedAt: string }, signal?: AbortSignal, requestId?: string): Promise<Project> => {
      const options = callOptions(signal, session(token));
      const fields = { name: payload.name, activeSequence: payload.activeSequence, workspace: workspaceMessage(payload.workspace) };
      const createFields = { ...fields, requestId: requestId ?? '' };
      const length=active?toBinary(UpdateProjectRequestSchema,create(UpdateProjectRequestSchema,{...fields,id:active.id,expectedUpdateTime:timestampFromIso(active.updatedAt)})).byteLength:toBinary(CreateProjectRequestSchema,create(CreateProjectRequestSchema,createFields)).byteLength;
      if(length>2_000_000)throw new ApiError(payload.workspace.laboratory?'laboratory-size':payload.workspace.generatorHistory?'generator-history-size':'validation');
      const { project } = await rpc(async () => active
        ? client.updateProject({ ...fields, id: active.id, expectedUpdateTime: timestampFromIso(active.updatedAt) }, options)
        : client.createProject(createFields, options));
      return validated(projectSchema, projectDocument(project));
    },
    remove: async (id: string, updatedAt: string, token: string, signal?: AbortSignal): Promise<void> => {
      await rpc(() => client.deleteProject({ id, expectedUpdateTime: timestampFromIso(updatedAt) }, callOptions(signal, session(token))));
    },
    /** Earlier contents, newest first; compact previews only. */
    versions: async (id: string, token: string, signal?: AbortSignal): Promise<ProjectVersion[]> => {
      const response = await rpc(() => client.listProjectVersions({ projectId: id }, callOptions(signal, session(token))));
      return validated(projectVersionListSchema, response.versions.map(versionDocument));
    },
    /** Puts a version back; what is stored now becomes a version. Guarded by the project's update time. */
    restore: async (id: string, versionId: string, updatedAt: string, token: string, signal?: AbortSignal): Promise<Project> => {
      const { project } = await rpc(() => client.restoreProjectVersion({ projectId: id, versionId, expectedUpdateTime: timestampFromIso(updatedAt) }, callOptions(signal, session(token))));
      return validated(projectSchema, projectDocument(project));
    },
    /** Starts or replaces the read-only link; the token is in this answer only. */
    createShare: async (id: string, token: string, signal?: AbortSignal): Promise<CreatedShare> => {
      const response = await rpc(() => client.createProjectShare({ projectId: id }, callOptions(signal, session(token))));
      return validated(createdShareSchema, { token: response.token, share: shareDocument(response.share) });
    },
    /** The current link's dates, never its token; null when there is none. */
    share: async (id: string, token: string, signal?: AbortSignal): Promise<ProjectShare | null> => {
      const response = await rpc(() => client.getProjectShare({ projectId: id }, callOptions(signal, session(token))));
      return response.share ? validated(projectShareSchema, shareDocument(response.share)) : null;
    },
    removeShare: async (id: string, token: string, signal?: AbortSignal): Promise<void> => {
      await rpc(() => client.deleteProjectShare({ projectId: id }, callOptions(signal, session(token))));
    },
  };
}
type FullProjectApi = ReturnType<typeof createProjectApi>;
/** Versions are optional for callers: a stand-in without them answers that versions are unavailable. */
type Optional = 'versions' | 'restore' | 'createShare' | 'share' | 'removeShare';
export type ProjectApi = Omit<FullProjectApi, Optional> & Partial<Pick<FullProjectApi, Optional>>;
