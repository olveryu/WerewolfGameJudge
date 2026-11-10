/**
 * API and site URL configuration. Pure config module; values come from Vite env variables at
 * build time. The API URL is set per mode (`.env.production`, `.env.test`) or by the environment
 * (the dev script and E2E builds point it at a local Worker).
 */

function readApiBaseUrl(): string {
  const url = import.meta.env.VITE_CF_API_URL;
  if (url === undefined || url === '') {
    throw new Error(
      `[FAIL-FAST] VITE_CF_API_URL is not set for Vite mode "${import.meta.env.MODE}"`,
    );
  }
  return url;
}

/** Cloudflare Workers API base URL. */
export const API_BASE_URL: string = readApiBaseUrl();

const DEFAULT_API_TIMEOUT_MS = 12000;

function readApiTimeoutMs(): number {
  const raw = import.meta.env.VITE_API_TIMEOUT_MS;
  if (raw === undefined) return DEFAULT_API_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`VITE_API_TIMEOUT_MS must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

/**
 * API request timeout in ms. Defaults to 12 s: the first TLS handshake from China to Cloudflare
 * can take 3–5 s.
 */
export const API_TIMEOUT_MS: number = readApiTimeoutMs();
