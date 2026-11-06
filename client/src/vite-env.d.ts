/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_POCKETBASE_URL?: string;
  readonly VITE_MAIL_URL?: string;
  readonly VITE_AI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
