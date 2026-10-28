/** In-memory fetch double and ApiClient factory for HTTP-layer tests. */
import { AuthTokenStore, type TokenStorage } from '@/platform/auth/AuthTokenStore';
import { ApiClient } from '@/platform/http/ApiClient';

export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string | Blob | FormData | null;
}

type FetchHandler = (request: RecordedRequest) => Response | Promise<Response> | Error;

export interface FakeFetch {
  readonly fetch: typeof fetch;
  readonly requests: RecordedRequest[];
  /** Queue one response or error for the next fetch call. */
  respond(handler: FetchHandler): void;
}

export function createFakeFetch(): FakeFetch {
  const queue: FetchHandler[] = [];
  const requests: RecordedRequest[] = [];
  return {
    requests,
    respond: (handler) => {
      queue.push(handler);
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input !== 'string') throw new Error('Fake fetch expects a string URL');
      const handler = queue.shift();
      if (handler === undefined) throw new Error(`Unexpected fetch ${input}`);
      const body = init?.body;
      if (
        body !== undefined &&
        body !== null &&
        typeof body !== 'string' &&
        !(body instanceof Blob) &&
        !(body instanceof FormData)
      ) {
        throw new Error('Fake fetch only records string, Blob or FormData bodies');
      }
      const recorded: RecordedRequest = {
        url: input,
        method: init?.method ?? 'GET',
        headers: { ...(init?.headers as Record<string, string> | undefined) },
        body: body ?? null,
      };
      requests.push(recorded);
      const signal = init?.signal ?? null;
      const abortError = (): Error =>
        signal?.reason instanceof Error ? signal.reason : new Error('Fake fetch aborted');
      if (signal?.aborted) throw abortError();
      const outcome = Promise.resolve(handler(recorded));
      const result =
        signal === null
          ? await outcome
          : await Promise.race([
              outcome,
              new Promise<never>((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(abortError()), { once: true });
              }),
            ]);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function createMemoryTokenStorage(): TokenStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}

export function createUnsignedAccessToken(userId: string, expiresAtSeconds: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  const nowSeconds = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'HS256' })}.${encode({
    sub: userId,
    ver: 0,
    iat: nowSeconds - 60,
    exp: expiresAtSeconds,
  })}.signature`;
}

export function createTestApiClient(options?: {
  readonly tokens?: AuthTokenStore;
  readonly networkRetryAttempts?: number;
  readonly defaultTimeoutMs?: number;
}): { readonly client: ApiClient; readonly tokens: AuthTokenStore; readonly network: FakeFetch } {
  const tokens = options?.tokens ?? new AuthTokenStore(createMemoryTokenStorage());
  const network = createFakeFetch();
  const client = new ApiClient({
    baseUrl: 'https://api.test',
    defaultTimeoutMs: options?.defaultTimeoutMs ?? 5_000,
    networkRetry: { attempts: options?.networkRetryAttempts ?? 0, baseDelayMs: 0 },
    tokens,
    fetch: network.fetch,
    logger: { debug: () => undefined, warn: () => undefined },
  });
  return { client, tokens, network };
}
