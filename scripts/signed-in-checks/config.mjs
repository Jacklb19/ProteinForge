/**
 * Settings of the owner self-checks. Origins come from the app's Vite environment (or `--api`);
 * limits mirror the backend defaults named next to each value. Nothing here is a credential.
 */
export const OWNER_CHECKS = {
  /** Vite mode whose `.env*` files hold the public Supabase origin, publishable key and API base. */
  envMode: 'development',
  /** Every check project starts with this name so a leftover is easy to recognise and delete. */
  projectNamePrefix: 'Comprobación del propietario',
  /** Closes only the session this script opened; the owner's browser sessions stay signed in. */
  logoutScope: 'local',
  /** Wait for any earlier reference window to lapse before counting (backend WINDOW_SECONDS = 60). */
  quota: {
    limit: 20, // backend UNIPROT_REQUESTS_PER_MINUTE default, shared by UniProt and SIFTS lookups
    windowSeconds: 60,
    settleSeconds: 61,
    ownBudgetDetail: 'uniprot-rate-limit',
    providerLimitDetail: 'sifts-provider-rate-limit',
    // Public reference already read in production on 1 Nov 2026 (P01308 → 1TRZ).
    accession: 'P01308',
    pdbId: '1TRZ',
  },
  /** REST bound; the SIFTS mapping wait mirrors libraryApi.ts (20 s acquisition plus margin). */
  requestTimeoutMs: 25_000,
  mappingTimeoutMs: 25_000,
  /** Seconds past the JWT `exp` claim before the expired copy is sent, to absorb clock skew. */
  expirySkewSeconds: 30,
  /** Progress line interval while waiting, in seconds. */
  waitReportSeconds: 60,
  /** Unreachable-by-design inputs: a probe that passes authentication can never change stored data. */
  probeInputs: {
    absentProjectId: '00000000-0000-7000-8000-000000000000',
    absentProjectTime: '2000-01-01T00:00:00.000Z',
    invalidAccession: 'INVALID',
    invalidPdbId: '0000',
    shortSequence: 'AA',
  },
  /** Backend REST equivalents of the gRPC methods (backend app/config.py API_PREFIX = "/v1"). */
  rest: {
    me: '/v1/me',
    projects: '/v1/projects',
    project: (id) => `/v1/projects/${id}`,
    uniprotSearch: '/v1/uniprot/search',
    uniprotEntry: (accession) => `/v1/uniprot/${accession}`,
    residueMapping: (pdbId) => `/v1/pdb/${pdbId}/residue-mapping`,
    interpret: '/v1/assistant/interpret',
    fold: '/v1/predictions/fold',
  },
  /** PostgREST paths the API uses with the caller's own JWT (backend app/projects.py). */
  supabaseRest: {
    base: '/rest/v1',
    table: '/projects',
    documentRpc: '/rpc/pf_project_document',
    saveRpc: '/rpc/pf_save_project',
    deleteRpc: '/rpc/pf_delete_project',
  },
  /** Stable PostgREST/PostgreSQL error codes that mean "not yours" or "refused" (backend data_request). */
  supabaseDeniedCodes: ['PT404', 'PT409', '42501'],
  /** Server detail strings are printed only when they look like a stable code. */
  detailPattern: /^[a-z0-9][a-z0-9-]{0,63}$/,
  /** PostgREST codes (PGRST…), custom PT codes and five-character SQLSTATE values. */
  postgrestCodePattern: /^(?:PGRST\d{3}|PT\d{3}|[0-9A-Z]{5})$/,
};
