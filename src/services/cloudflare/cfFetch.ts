/**
 * cfFetch — Cloudflare Workers API HTTP client
 *
 * Unified fetch wrapper: JWT Bearer token injection, timeout (AbortSignal.timeout),
 * network-layer auto retry (fetchWithRetry), JSON response parsing,
 * 401 auto refresh (single refresh lock + queue),
 * owner-provided runtime response decoding and structured HTTP errors.
 * Pure IO module, no business logic.
 */

import { API_BASE_URL, API_TIMEOUT_MS, FETCH_RETRY_BASE_MS, FETCH_RETRY_COUNT } from '@/config/api';
import { createTimeoutSignal } from '@/utils/abortSignal';
import { cfFetchLog } from '@/utils/logger';

import { isAccessTokenClaimsExpired, parseAccessTokenClaims } from './accessTokenClaims';

/** Runtime decoder owned by the endpoint consumer. */
export type JsonResponseDecoder<T> = (value: unknown) => T;

/** A non-successful HTTP response with one normalized server reason. */
export class CloudflareHttpError extends Error {
  readonly status: number;
  readonly reason: string;
  readonly body: unknown;

  constructor(options: {
    readonly status: number;
    readonly reason: string;
    readonly body: unknown;
    readonly cause?: unknown;
  }) {
    super(options.reason, { cause: options.cause });
    this.name = 'CloudflareHttpError';
    this.status = options.status;
    this.reason = options.reason;
    this.body = options.body;
  }
}

/** A successful response whose JSON does not satisfy its endpoint contract. */
export class CloudflareResponseProtocolError extends Error {
  readonly path: string;
  readonly status: number;
  readonly body: unknown;

  constructor(options: {
    readonly path: string;
    readonly status: number;
    readonly body: unknown;
    readonly cause?: unknown;
  }) {
    super(`[FAIL-FAST] Invalid JSON response contract for ${options.path}`, {
      cause: options.cause,
    });
    this.name = 'CloudflareResponseProtocolError';
    this.path = options.path;
    this.status = options.status;
    this.body = options.body;
  }
}

// ── Token management ────────────────────────────────────────────────────────

/** Callback to read access token from in-memory cache (injected by CFAuthService) */
let tokenProvider: (() => string | null) | null = null;

/** Callback to execute refresh token -> new token pair (injected by CFAuthService) */
let refreshHandler: (() => Promise<'refreshed' | 'expired' | 'offline'>) | null = null;

/** Callback when refresh also fails (token fully expired) (injected by CFAuthService) */
let onAuthExpired: (() => void) | null = null;

/** Inject access token reader callback (called by CFAuthService). */
export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

/** Inject refresh token executor callback (called by CFAuthService). */
export function setRefreshHandler(
  handler: () => Promise<'refreshed' | 'expired' | 'offline'>,
): void {
  refreshHandler = handler;
}

/** Inject callback for when token is fully expired (triggers re-login flow). */
export function setOnAuthExpired(handler: () => void): void {
  onAuthExpired = handler;
}

/** Get current JWT token (for non-cfFetch callers such as the avatar upload adapter). */
export function getCurrentToken(): string | null {
  return tokenProvider?.() ?? null;
}

// ── Refresh lock: ensures only one refresh request at a time ────────────────

let refreshPromise: Promise<'refreshed' | 'expired' | 'offline'> | null = null;

/**
 * Locked refresh: multiple concurrent 401 requests share the same refresh call.
 * Returns 'refreshed' if new token obtained, 'expired' if session dead, 'offline' if network error.
 *
 * @remarks single-flight lock: first 401 triggers refresh, subsequent 401s queue for the same result.
 *   Prevents refresh token from being consumed multiple times (rotation is single-use).
 */
async function refreshWithLock(): Promise<'refreshed' | 'expired' | 'offline'> {
  if (!refreshHandler) return 'expired';

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshHandler().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// ── Token freshness (for non-HTTP callers) ──────────────────────────────────

/**
 * Local JWT expiry check (no signature verification, 30s clock-skew buffer).
 * Malformed token / missing `exp` → treated as expired.
 */
export function isAccessTokenExpired(token: string): boolean {
  try {
    const claims = parseAccessTokenClaims(token);
    return isAccessTokenClaimsExpired(claims);
  } catch {
    return true;
  }
}

/**
 * Ensure a non-expired access token before a non-HTTP operation (e.g. WebSocket
 * upgrade) that cannot surface a 401 to the {@link executeRequest} refresh interceptor.
 *
 * @returns Fresh token, or `null` if there is no session / the session is dead.
 * @remarks Reuses the single-flight {@link refreshWithLock}, so a parallel cfFetch 401
 *   and a WS reconnect share one refresh network call.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const token = tokenProvider?.() ?? null;
  if (!token) return null;
  if (!isAccessTokenExpired(token)) return token;

  const result = await refreshWithLock();
  if (result === 'refreshed') return tokenProvider?.() ?? null;
  if (result === 'expired') {
    onAuthExpired?.();
    return null;
  }
  // 'offline': keep the existing token; the WS handshake (and its backoff retry)
  // may still succeed once the network recovers.
  return token;
}

// ── Network-layer retry ─────────────────────────────────────────────────────

/**
 * Network-layer retry: only retries TypeError thrown by fetch() (DNS/TCP/TLS failure = request likely never reached server).
 * DOMException (AbortError/TimeoutError) and programming errors are thrown immediately, no retry.
 *
 * @throws {TypeError} Still fails after FETCH_RETRY_COUNT retries
 * @throws {DOMException} AbortError/TimeoutError — thrown immediately, no retry
 */
async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (init?.signal?.aborted) throw error;
      if (attempt === FETCH_RETRY_COUNT) throw error;
      const delay = FETCH_RETRY_BASE_MS * 2 ** attempt;
      cfFetchLog.debug('fetch network error, retrying', {
        attempt: attempt + 1,
        delay,
        error: error.message,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('fetchWithRetry: unreachable');
}

// ── Internal request execution (with 401 interception) ─────────────────────

interface RequestOptions<T> {
  method: string;
  path: string;
  body?: string | FormData;
  headers: Record<string, string>;
  timeoutMs: number;
  decode: JsonResponseDecoder<T>;
  noRetry?: boolean;
  /** This is the refresh request itself; skip 401 interception */
  skipAuthIntercept?: boolean;
}

async function executeRequest<T>(opts: RequestOptions<T>): Promise<T> {
  const url = `${API_BASE_URL}${opts.path}`;
  const fetchFn = opts.noRetry ? fetch : fetchWithRetry;

  const doFetch = (headers: Record<string, string>) =>
    fetchFn(url, {
      method: opts.method,
      headers,
      body: opts.body,
      signal: createTimeoutSignal(opts.timeoutMs),
    });

  // First request
  const headers = { ...opts.headers };
  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await doFetch(headers);

  // 401 interception: attempt refresh and retry once
  if (res.status === 401 && !opts.skipAuthIntercept && refreshHandler) {
    cfFetchLog.debug('401 received, attempting refresh', { path: opts.path });
    const refreshResult = await refreshWithLock();
    if (refreshResult === 'refreshed') {
      // Retry with new token
      const retryHeaders = { ...opts.headers };
      const newToken = tokenProvider?.();
      if (newToken) {
        retryHeaders['Authorization'] = `Bearer ${newToken}`;
      }
      const retryRes = await doFetch(retryHeaders);
      return parseJsonResponse(retryRes, opts.path, opts.decode);
    }
    if (refreshResult === 'expired') {
      // Session fully dead — notify UI and fail fast
      onAuthExpired?.();
      throw new CloudflareHttpError({
        status: 401,
        reason: 'AUTH_EXPIRED',
        body: null,
      });
    }
    // refreshResult === 'offline': network error during refresh, don't sign out
    // Fall through to parseJsonResponse so TanStack Query can retry
  }

  return parseJsonResponse(res, opts.path, opts.decode);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a JSON POST request to the Workers API.
 */
export async function cfPost<T>(
  path: string,
  body: Record<string, unknown> | undefined,
  decode: JsonResponseDecoder<T>,
  options?: {
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
    noRetry?: boolean;
    skipAuthIntercept?: boolean;
  },
): Promise<T> {
  cfFetchLog.debug('POST', { path });
  return executeRequest({
    method: 'POST',
    path,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options?.extraHeaders,
    },
    timeoutMs: options?.timeoutMs ?? API_TIMEOUT_MS,
    decode,
    noRetry: options?.noRetry,
    skipAuthIntercept: options?.skipAuthIntercept,
  });
}

/**
 * Send a GET request to the Workers API.
 */
export async function cfGet<T>(
  path: string,
  decode: JsonResponseDecoder<T>,
  options?: { skipAuthIntercept?: boolean; noRetry?: boolean; timeoutMs?: number },
): Promise<T> {
  cfFetchLog.debug('GET', { path });
  return executeRequest({
    method: 'GET',
    path,
    headers: {},
    timeoutMs: options?.timeoutMs ?? API_TIMEOUT_MS,
    decode,
    noRetry: options?.noRetry,
    skipAuthIntercept: options?.skipAuthIntercept,
  });
}

/**
 * Send a PUT request to the Workers API.
 */
export async function cfPut<T>(
  path: string,
  body: Record<string, unknown> | undefined,
  decode: JsonResponseDecoder<T>,
): Promise<T> {
  cfFetchLog.debug('PUT', { path });
  return executeRequest({
    method: 'PUT',
    path,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
    timeoutMs: API_TIMEOUT_MS,
    decode,
  });
}

/**
 * Parse JSON and apply the endpoint owner's decoder before data crosses the transport boundary.
 */
async function parseJsonResponse<T>(
  res: Response,
  path: string,
  decode: JsonResponseDecoder<T>,
): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      cfFetchLog.warn('HTTP error (non-JSON)', {
        status: res.status,
        statusText: res.statusText,
        path,
      });
      throw new CloudflareHttpError({
        status: res.status,
        reason: 'SERVER_ERROR',
        body: null,
      });
    }
    cfFetchLog.warn('Non-JSON 200 response', { path, status: res.status, contentType });
    throw new CloudflareResponseProtocolError({
      path,
      status: res.status,
      body: null,
    });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (cause) {
    if (!res.ok) {
      throw new CloudflareHttpError({
        status: res.status,
        reason: 'SERVER_ERROR',
        body: null,
        cause,
      });
    }
    throw new CloudflareResponseProtocolError({
      path,
      status: res.status,
      body: null,
      cause,
    });
  }

  if (!res.ok) {
    const reason = readErrorReason(data);
    cfFetchLog.warn('HTTP error', {
      status: res.status,
      path,
      reason,
    });
    throw new CloudflareHttpError({
      status: res.status,
      reason: reason ?? 'SERVER_ERROR',
      body: data,
      cause:
        reason === null
          ? new Error(`[FAIL-FAST] Invalid HTTP error envelope for ${path}`)
          : undefined,
    });
  }

  try {
    return decode(data);
  } catch (cause) {
    throw new CloudflareResponseProtocolError({
      path,
      status: res.status,
      body: data,
      cause,
    });
  }
}

function readErrorReason(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const reason =
    'reason' in value && typeof value.reason === 'string' && value.reason.length > 0
      ? value.reason
      : null;
  const middlewareError =
    'error' in value && typeof value.error === 'string' && value.error.length > 0
      ? value.error
      : null;
  if ((reason === null) === (middlewareError === null)) return null;
  return reason ?? middlewareError;
}

/**
 * Upload multipart/form-data to the Workers API.
 */
export async function cfUpload<T>(
  path: string,
  formData: FormData,
  decode: JsonResponseDecoder<T>,
  timeoutMs?: number,
): Promise<T> {
  cfFetchLog.debug('UPLOAD', { path });
  return executeRequest({
    method: 'POST',
    path,
    body: formData, // FormData handled by fetch natively
    headers: {}, // No Content-Type — let browser set multipart boundary
    timeoutMs: timeoutMs ?? API_TIMEOUT_MS,
    decode,
  });
}
