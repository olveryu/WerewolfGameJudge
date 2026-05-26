/**
 * api - API / Site URL configuration
 *
 * Cloudflare Workers backend + frontend site URL. Pure config module, no business logic or side effects.
 */

/**
 * Frontend site URL (custom domain).
 * Consumed by native share links, deep link prefix, etc.
 */
export const SITE_URL: string = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://werewolfjudge.eu.org';

/**
 * Cloudflare Workers base URL
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_CF_API_URL ?? 'https://api.werewolfjudge.eu.org';

/**
 * Edge Function region routing header value.
 *
 * - Can be overridden via EXPO_PUBLIC_API_REGION (e.g. `ap-southeast-1`)
 * - Default keeps existing production config
 */
export const API_REGION: string = process.env.EXPO_PUBLIC_API_REGION ?? 'us-west-1';

/**
 * API request timeout (milliseconds).
 *
 * - Can be overridden via EXPO_PUBLIC_API_TIMEOUT_MS
 * - Defaults to 12000ms; first TLS handshake from China -> CF can take 3-5s
 */
export const API_TIMEOUT_MS: number = (() => {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  if (!raw) return 12000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12000;
})();

/** Network-layer fetch retry count (retries only on fetch() exceptions, not on HTTP error responses) */
export const FETCH_RETRY_COUNT = 2;

/** Network-layer fetch retry base backoff (milliseconds), exponential backoff: 1s, 2s */
export const FETCH_RETRY_BASE_MS = 1000;
