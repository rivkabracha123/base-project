/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FIXTURE_MODE?: 'true' | 'false';
  /** When true, /chat uses POST /buyer/conversation/message (P4 + B2 orchestrator) instead of demo conversation. */
  readonly VITE_BUYER_LIVE_FLOW?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
