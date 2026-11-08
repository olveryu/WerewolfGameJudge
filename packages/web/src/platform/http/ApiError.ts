/** The one error type thrown by `ApiClient`; `kind` is the classification callers branch on. */

export type ApiErrorKind =
  /** Server answered with a non-2xx status; `status` and `reason` are set. */
  | 'http'
  /** fetch() failed or the response stream broke before the body was read. */
  | 'network'
  /** The request exceeded its deadline. */
  | 'timeout'
  /** The caller's AbortSignal fired or the bound identity changed mid-flight. */
  | 'aborted'
  /** A 2xx response violated the endpoint contract (non-JSON, undecodable, wrong content type). */
  | 'contract';

interface ApiErrorInit {
  readonly kind: ApiErrorKind;
  readonly path: string;
  readonly status?: number;
  readonly reason?: string;
  readonly body?: unknown;
  readonly cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly path: string;
  readonly status: number | null;
  readonly reason: string | null;
  readonly body: unknown;

  constructor(init: ApiErrorInit) {
    super(init.reason ?? `${init.kind} error for ${init.path}`, { cause: init.cause });
    this.name = 'ApiError';
    this.kind = init.kind;
    this.path = init.path;
    this.status = init.status ?? null;
    this.reason = init.reason ?? null;
    this.body = init.body;
  }

  /** Narrow to an HTTP rejection carrying a server status. */
  isHttp(): this is ApiError & { readonly status: number; readonly reason: string } {
    return this.kind === 'http';
  }
}
