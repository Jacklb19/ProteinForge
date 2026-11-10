/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL; identity is disabled while it is empty. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable or legacy anon public key; access is bounded by RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Base URL of the ProteinForge API, used for health and account verification. */
  readonly VITE_API_BASE_URL?: string;
  /** Commit of the build, set by vite.config.ts; empty when unknown. */
  readonly VITE_APP_BUILD?: string;
  /** `enabled` offers saving generator searches in Projects; needs a backend with workspace version 3. */
  readonly VITE_GENERATOR_HISTORY?: string;
  /** `enabled` offers saving reports to the account; needs the report storage migration and backend. */
  readonly VITE_REPORT_STORAGE?: string;
  /** Explicit opt-in to the authenticated folding service; needs workspace v4 support. */
  readonly VITE_STRUCTURE_PREDICTION?: string;
  /** `enabled` lets queued project creates retry on their own; needs CreateProject request ids in the API. */
  readonly VITE_PROJECT_CREATE_IDEMPOTENCY?: string;
  /** `enabled` opens the API's live channel (WebSocket) for project changes; needs an API with LIVE_ENABLED. */
  readonly VITE_PROJECT_LIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
