/**
 * Network-layer fetch retry policy. Kept free of `import.meta.env` so E2E specs can import the
 * same numbers the client uses.
 */

/** Network-layer fetch retry count (retries only fetch() exceptions, not HTTP error responses). */
export const FETCH_RETRY_COUNT = 2;

/** Network-layer fetch retry base backoff in ms; exponential: 1 s, 2 s. */
export const FETCH_RETRY_BASE_MS = 1000;
