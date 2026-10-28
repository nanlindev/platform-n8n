/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_EDITOR_BASE_URL: string;
  readonly VITE_HIDE_EXECUTION_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
