/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API-ийн хаяг (D105). Байхгүй бол deploy хийсэн Worker (https://aeris-api.oorgilmojo.workers.dev). */
  readonly VITE_API_URL?: string;
}
