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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
