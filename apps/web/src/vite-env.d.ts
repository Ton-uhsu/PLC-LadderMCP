/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLC_LADDER_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
