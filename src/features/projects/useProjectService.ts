import { useCallback, useEffect, useRef, useState } from 'react';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/errors';
import type { ProjectApi } from './projectApi';

/**
 * The service client carries the generated contracts, which a visit that never opens a project does not
 * need. It is fetched on sign-in; an action that arrives before it lands waits for the same request
 * instead of failing silently. `api` replaces it in tests: null means projects are off.
 */
export function useProjectService(api: ProjectApi | null | undefined, signedIn: boolean): { client: ProjectApi | null; enabled: boolean; serviceClient: () => Promise<ProjectApi | null> } {
  const [configuredUrl] = useState(readApiBaseUrl);
  const [configuredApi, setConfiguredApi] = useState<ProjectApi | null>(null);
  const loading = useRef<Promise<ProjectApi | null> | null>(null);
  const serviceClient = useCallback(async (): Promise<ProjectApi | null> => {
    if (api !== undefined) return api;
    if (!configuredUrl) return null;
    loading.current ??= import('./projectApi').then(({ createProjectApi }) => createProjectApi(configuredUrl));
    try {
      const resolved = await loading.current;
      setConfiguredApi(resolved);
      return resolved;
    } catch {
      // The file may be unreachable offline or after a replaced build; let the next action try again.
      loading.current = null;
      throw new ApiError('network');
    }
  }, [api, configuredUrl]);
  useEffect(() => {
    if (signedIn) void serviceClient().catch(() => undefined);
  }, [signedIn, serviceClient]);
  return { client: api === undefined ? configuredApi : api, enabled: api === undefined ? Boolean(configuredUrl) : api !== null, serviceClient };
}
