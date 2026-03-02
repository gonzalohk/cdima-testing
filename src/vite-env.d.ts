/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASANA_TOKEN?: string;
  readonly VITE_ASANA_WORKSPACE_ID?: string;
  readonly VITE_ASANA_PROJECT_ID?: string;
  readonly VITE_API_URL?: string;
  // Agrega más variables de entorno aquí según las necesites
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
