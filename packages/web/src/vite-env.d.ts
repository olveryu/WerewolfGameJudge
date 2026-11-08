/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN; set by the deploy build. */
  readonly VITE_SENTRY_DSN?: string;
  /** Deploy environment name reported to Sentry (Cloudflare Pages branch). */
  readonly VITE_DEPLOY_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
