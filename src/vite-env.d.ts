/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL; identity is disabled while it is empty. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase public (anon) key; it is safe in the client and never grants more than RLS allows. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Base URL of the ProteinForge API; unused until the API exists. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
