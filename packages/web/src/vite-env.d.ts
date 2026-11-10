/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN; set by the deploy build. */
  readonly VITE_SENTRY_DSN?: string;
  /** Deploy environment name reported to Sentry (Cloudflare Pages branch). */
  readonly VITE_DEPLOY_ENV?: string;
  /** API Worker base URL; from `.env.production` / `.env.test` or the environment. Required. */
  readonly VITE_CF_API_URL?: string;
  /** API request timeout in ms; defaults to 12000. */
  readonly VITE_API_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
