/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT: string
  readonly VITE_MODERN_URL?: string
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
