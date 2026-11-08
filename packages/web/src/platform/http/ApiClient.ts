/**
 * ApiClient — the client's single HTTP boundary to the Worker.
 *
 * One instance, constructed once with its dependencies; no module-level mutable state.
 * Responsibilities: bearer injection, deadline, network retry for idempotent requests,
 * strict JSON/binary response decoding, single-flight refresh on 401, and token freshness
 * for non-HTTP consumers (WebSocket upgrade). Every failure is an `ApiError`.
 */
import {
  isAccessTokenClaimsExpired,
  parseAccessTokenClaims,
} from '@/platform/auth/accessTokenClaims';
import type { AuthTokenStore } from '@/platform/auth/AuthTokenStore';
import { parseTokenPairResponse } from '@/platform/auth/tokenPair';
import type { AuthSession } from '@/services/types/IAuthService';
import { composeAbortSignals, createTimeoutSignal } from '@/utils/abortSignal';

import { ApiError } from './ApiError';

/**
 * - `required`: send bearer; on 401 refresh once and retry with the new token.
 * - `passthrough`: send bearer if present; 401 is returned to the caller (auth service internals).
 * - `none`: no bearer (sign-in, refresh, password reset).
 */
export type ApiAuthMode = 'required' | 'passthrough' | 'none';

type JsonBody = Record<string, unknown>;

interface BaseRequestSpec {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly path: string;
  readonly auth: ApiAuthMode;
  /** Only idempotent requests are retried when fetch() itself fails. */
  readonly idempotent: boolean;
  readonly body?: JsonBody | Blob | FormData;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface JsonRequestSpec<T> extends BaseRequestSpec {
  readonly decode: (value: unknown) => T;
}

export interface BinaryRequestSpec extends BaseRequestSpec {
  readonly method: 'GET';
  readonly contentType: string;
}

export interface ApiClientLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly defaultTimeoutMs: number;
  readonly networkRetry: { readonly attempts: number; readonly baseDelayMs: number };
  readonly tokens: AuthTokenStore;
  readonly fetch: typeof fetch;
  readonly logger: ApiClientLogger;
}

export type RefreshOutcome = 'refreshed' | 'expired' | 'offline';

const REFRESH_PATH = '/auth/refresh';

function abortReason(signal: AbortSignal, path: string): ApiError {
  const reason: unknown = signal.reason;
  // AbortSignal.timeout() reasons may come from another realm; match by name, not constructor.
  const isTimeout =
    typeof reason === 'object' &&
    reason !== null &&
    'name' in reason &&
    reason.name === 'TimeoutError';
  return new ApiError({ kind: isTimeout ? 'timeout' : 'aborted', path, cause: reason });
}

function readErrorReason(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const reason =
    'reason' in body && typeof body.reason === 'string' && body.reason.length > 0
      ? body.reason
      : null;
  const middlewareError =
    'error' in body && typeof body.error === 'string' && body.error.length > 0 ? body.error : null;
  if ((reason === null) === (middlewareError === null)) return null;
  return reason ?? middlewareError;
}

function wait(delayMs: number, signal: AbortSignal, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal, path));
      return;
    }
    const handleAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal, path));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export class ApiClient {
  readonly #options: ApiClientOptions;
  #refreshInFlight: {
    readonly session: AuthSession | null;
    readonly promise: Promise<RefreshOutcome>;
  } | null = null;

  constructor(options: ApiClientOptions) {
    if (options.baseUrl.endsWith('/')) throw new Error('ApiClient baseUrl must not end with "/"');
    this.#options = options;
  }

  /** Send a request whose 2xx body is JSON decoded by `spec.decode`. */
  async json<T>(spec: JsonRequestSpec<T>): Promise<T> {
    return this.#execute(spec, (response) => this.#readJson(response, spec.path, spec.decode));
  }

  /** Download a binary 2xx body whose content type must match exactly. */
  async binary(spec: BinaryRequestSpec): Promise<ArrayBuffer> {
    return this.#execute(spec, (response) =>
      this.#readBinary(response, spec.path, spec.contentType),
    );
  }

  /** Current access token without freshness guarantees (streaming endpoints that cannot refresh). */
  currentAccessToken(): string | null {
    return this.#options.tokens.accessToken;
  }

  /**
   * Return a non-expired access token for non-HTTP consumers, refreshing when the local claims
   * say it is expired. `null` means there is no session or refresh proved it dead.
   */
  async ensureFreshAccessToken(): Promise<string | null> {
    const { tokens } = this.#options;
    const token = tokens.accessToken;
    if (token === null) return null;
    if (!this.#isLocallyExpired(token)) return token;

    const session = tokens.session;
    const outcome = await this.#refreshOnce();
    if (outcome === 'expired') return null;
    this.#assertSession(session, REFRESH_PATH);
    if (outcome === 'refreshed') return tokens.accessToken;
    return token;
  }

  /** Exchange the stored refresh token once; concurrent callers share one network round trip. */
  refresh(): Promise<RefreshOutcome> {
    return this.#refreshOnce();
  }

  #isLocallyExpired(token: string): boolean {
    try {
      return isAccessTokenClaimsExpired(parseAccessTokenClaims(token));
    } catch {
      return true;
    }
  }

  #assertSession(session: AuthSession | null, path: string): void {
    if (this.#options.tokens.session !== session) {
      throw new ApiError({
        kind: 'aborted',
        path,
        cause: new DOMException('Authentication changed', 'AbortError'),
      });
    }
  }

  async #execute<T>(spec: BaseRequestSpec, read: (response: Response) => Promise<T>): Promise<T> {
    const { tokens, logger } = this.#options;
    const session = tokens.session;
    logger.debug(spec.method, { path: spec.path });

    const first = await this.#send(spec, this.#bearer(spec.auth));
    this.#assertSession(session, spec.path);
    if (first.status !== 401 || spec.auth !== 'required') {
      return this.#settle(first, spec.path, read);
    }

    const unauthorized = await this.#readHttpError(first, spec.path);
    const outcome = await this.#refreshOnce(spec.signal, spec.path);
    if (outcome === 'expired') {
      throw new ApiError({ kind: 'http', path: spec.path, status: 401, reason: 'AUTH_EXPIRED' });
    }
    this.#assertSession(session, spec.path);
    if (outcome === 'offline') throw unauthorized;
    const retried = await this.#send(spec, this.#bearer(spec.auth));
    this.#assertSession(session, spec.path);
    return this.#settle(retried, spec.path, read);
  }

  async #settle<T>(
    response: Response,
    path: string,
    read: (response: Response) => Promise<T>,
  ): Promise<T> {
    if (!response.ok) throw await this.#readHttpError(response, path);
    return read(response);
  }

  #bearer(auth: ApiAuthMode): Record<string, string> {
    if (auth === 'none') return {};
    const token = this.#options.tokens.accessToken;
    return token === null ? {} : { Authorization: `Bearer ${token}` };
  }

  async #send(spec: BaseRequestSpec, authHeaders: Record<string, string>): Promise<Response> {
    const { baseUrl, defaultTimeoutMs, networkRetry, fetch: fetchImpl, logger } = this.#options;
    const headers: Record<string, string> = { ...spec.headers, ...authHeaders };
    let body: BodyInit | undefined;
    if (spec.body instanceof Blob || spec.body instanceof FormData) {
      body = spec.body;
    } else if (spec.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(spec.body);
    }

    const timeoutSignal = createTimeoutSignal(spec.timeoutMs ?? defaultTimeoutMs);
    const composition = composeAbortSignals(
      spec.signal === undefined ? [timeoutSignal] : [spec.signal, timeoutSignal],
    );
    const init: RequestInit = { method: spec.method, headers, body, signal: composition.signal };
    const url = `${baseUrl}${spec.path}`;
    const maxAttempts = spec.idempotent ? networkRetry.attempts + 1 : 1;

    try {
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await fetchImpl(url, init);
        } catch (error) {
          if (composition.signal.aborted) throw abortReason(composition.signal, spec.path);
          if (!(error instanceof TypeError)) throw error;
          if (attempt === maxAttempts) {
            throw new ApiError({ kind: 'network', path: spec.path, cause: error });
          }
          const delayMs = networkRetry.baseDelayMs * 2 ** (attempt - 1);
          logger.debug('fetch failed, retrying', { path: spec.path, attempt, delayMs });
          await wait(delayMs, composition.signal, spec.path);
        }
      }
    } finally {
      composition.dispose();
    }
  }

  async #readHttpError(response: Response, path: string): Promise<ApiError> {
    const contentType = response.headers.get('content-type') ?? '';
    const status = response.status;
    if (!contentType.includes('application/json')) {
      this.#options.logger.warn('HTTP error without JSON body', { path, status });
      return new ApiError({ kind: 'http', path, status, reason: 'SERVER_ERROR', body: null });
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      return new ApiError({
        kind: 'http',
        path,
        status,
        reason: 'SERVER_ERROR',
        body: null,
        cause,
      });
    }
    const reason = readErrorReason(body);
    this.#options.logger.warn('HTTP error', { path, status, reason });
    return new ApiError({
      kind: 'http',
      path,
      status,
      reason: reason ?? 'SERVER_ERROR',
      body,
      cause: reason === null ? new Error(`Invalid HTTP error envelope for ${path}`) : undefined,
    });
  }

  async #readJson<T>(response: Response, path: string, decode: (value: unknown) => T): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new ApiError({
        kind: 'contract',
        path,
        status: response.status,
        body: { contentType },
        cause: new Error('Successful response is not JSON'),
      });
    }
    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      throw new ApiError({ kind: 'network', path, status: response.status, cause });
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (cause) {
      throw new ApiError({ kind: 'contract', path, status: response.status, body: text, cause });
    }
    try {
      return decode(value);
    } catch (cause) {
      throw new ApiError({ kind: 'contract', path, status: response.status, body: value, cause });
    }
  }

  async #readBinary(response: Response, path: string, contentType: string): Promise<ArrayBuffer> {
    const actual = response.headers.get('content-type') ?? '';
    if (actual !== contentType) {
      throw new ApiError({
        kind: 'contract',
        path,
        status: response.status,
        body: { expectedContentType: contentType, contentType: actual },
      });
    }
    try {
      return await response.arrayBuffer();
    } catch (cause) {
      throw new ApiError({ kind: 'network', path, status: response.status, cause });
    }
  }

  async #refreshOnce(signal?: AbortSignal, path = REFRESH_PATH): Promise<RefreshOutcome> {
    const { tokens } = this.#options;
    const session = tokens.session;
    if (this.#refreshInFlight === null || this.#refreshInFlight.session !== session) {
      const promise = this.#performRefresh(session).finally(() => {
        if (this.#refreshInFlight?.promise === promise) this.#refreshInFlight = null;
      });
      this.#refreshInFlight = { session, promise };
    }
    const inFlight = this.#refreshInFlight.promise;
    if (signal === undefined) return inFlight;
    if (signal.aborted) throw abortReason(signal, path);
    let handleAbort: (() => void) | null = null;
    const aborted = new Promise<never>((_resolve, reject) => {
      handleAbort = () => reject(abortReason(signal, path));
      signal.addEventListener('abort', handleAbort, { once: true });
    });
    try {
      return await Promise.race([inFlight, aborted]);
    } finally {
      if (handleAbort !== null) signal.removeEventListener('abort', handleAbort);
    }
  }

  async #performRefresh(session: AuthSession | null): Promise<RefreshOutcome> {
    const { tokens, logger } = this.#options;
    const refreshToken = tokens.refreshToken;
    if (refreshToken === null) return 'expired';
    try {
      const pair = await this.json({
        method: 'POST',
        path: REFRESH_PATH,
        auth: 'none',
        // The Worker replays the same successor for a lost rotation response.
        idempotent: true,
        body: { refresh_token: refreshToken },
        decode: parseTokenPairResponse,
      });
      this.#assertSession(session, REFRESH_PATH);
      tokens.saveTokens(pair.access_token, pair.refresh_token);
      logger.debug('token refresh succeeded');
      return 'refreshed';
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.kind === 'aborted') throw error;
      if (error.kind === 'http' && error.status === 401) {
        this.#assertSession(session, REFRESH_PATH);
        logger.warn('refresh token rejected; session expired');
        tokens.expire();
        return 'expired';
      }
      if (error.kind === 'network' || error.kind === 'timeout') {
        logger.warn('token refresh offline', { kind: error.kind });
        return 'offline';
      }
      throw error;
    }
  }
}
