import { z } from 'zod';
import { ProjectService } from '../../gen/proteinforge/project/v1/project_service_pb';
import type { ProjectShare as ShareMessage } from '../../gen/proteinforge/project/v1/project_service_pb';
import { ApiError, validated } from '../api/apiClient';
import { callOptions, createRpcClient, rpc } from '../api/rpc';
import { isoFromTimestamp } from '../api/timestamps';
import { ROUTES } from '../../shared/navigation';
import { MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_SEQUENCE_LENGTH, PROJECT_SHARE_TOKEN_PATTERN } from './config';
import { workspaceSchema } from './contracts';
import { workspaceDocument } from './rpcMapping';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const projectShareSchema = z.object({ createdAt: z.iso.datetime({ offset: true }), expiresAt: z.iso.datetime({ offset: true }) });
export const createdShareSchema = z.object({ token: z.string().regex(PROJECT_SHARE_TOKEN_PATTERN), share: projectShareSchema });
/** What a link shows: name, sequence, analysis and comparison. The laboratory and searches are never part of it. */
export const sharedProjectSchema = z.object({
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  activeSequence: z.string().max(MAX_PROJECT_SEQUENCE_LENGTH).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]*$/),
  workspace: workspaceSchema.refine(workspace => workspace.schemaVersion === 1 && !workspace.laboratory && !workspace.generatorHistory),
  updatedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
});
export type ProjectShare = z.infer<typeof projectShareSchema>;
export type CreatedShare = z.infer<typeof createdShareSchema>;
export type SharedProject = z.infer<typeof sharedProjectSchema>;

export function shareDocument(share: ShareMessage | undefined): unknown {
  return share ? { createdAt: isoFromTimestamp(share.createTime), expiresAt: isoFromTimestamp(share.expireTime) } : null;
}

/**
 * The address a link opens. The token goes after `#`: browsers never send that part to a server, so it
 * stays out of access logs and of the Referer header.
 */
export function shareUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}${ROUTES.shared}#${token}`;
}

/** The token of the address being visited, or null when it is not one a link would carry. */
export function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '');
  return new RegExp(`^${PROJECT_SHARE_TOKEN_PATTERN.source}$`).test(token) ? token : null;
}

/** For a visitor without an account: the link's token is the only credential, no session is sent. */
export function createSharedApi(baseUrl: string, fetchImplementation?: FetchLike) {
  const client = createRpcClient(ProjectService, baseUrl, fetchImplementation);
  return {
    open: async (token: string, signal?: AbortSignal): Promise<SharedProject> => {
      if (!tokenFromHash(token)) throw new ApiError('not-found');
      const { project } = await rpc(() => client.getSharedProject({ token }, callOptions(signal)));
      return validated(sharedProjectSchema, {
        name: project?.name, activeSequence: project?.activeSequence, workspace: workspaceDocument(project?.workspace),
        updatedAt: isoFromTimestamp(project?.updateTime), expiresAt: isoFromTimestamp(project?.expireTime),
      });
    },
  };
}
