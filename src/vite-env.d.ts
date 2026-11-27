/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API-ийн хаяг (D105). Байхгүй бол локал `wrangler dev` (http://127.0.0.1:8787). */
  readonly VITE_API_URL?: string;
}
