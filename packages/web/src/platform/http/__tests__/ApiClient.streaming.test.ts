import { AuthTokenStore } from '@/platform/auth/AuthTokenStore';
import { ApiClient } from '@/platform/http/ApiClient';
import {
  createMemoryTokenStorage,
  createUnsignedAccessToken,
  jsonResponse,
} from '@/test-utils/httpClient';

describe('ApiClient streaming bodies without native AbortSignal composition', () => {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    for (const name of ['any', 'timeout']) {
      descriptors.set(name, Object.getOwnPropertyDescriptor(AbortSignal, name));
      Object.defineProperty(AbortSignal, name, { configurable: true, value: undefined });
    }
  });

  afterEach(() => {
    for (const stream of streams.splice(0)) stream.error(new Error('Test cleanup'));
    for (const [name, descriptor] of descriptors) {
      if (descriptor === undefined) Reflect.deleteProperty(AbortSignal, name);
      else Object.defineProperty(AbortSignal, name, descriptor);
    }
    descriptors.clear();
    vi.useRealTimers();
  });

  function createStreamingClient(status: number, binary = false, retryAfterRefresh = false) {
    const tokens = new AuthTokenStore(createMemoryTokenStorage());
    const initial: Response[] = [];
    if (retryAfterRefresh) {
      tokens.saveTokens(createUnsignedAccessToken('u1', Date.now() / 1000 + 3600), 'refresh');
      initial.push(
        jsonResponse(401, { reason: 'TOKEN_EXPIRED' }),
        jsonResponse(200, { access_token: 'rotated', refresh_token: 'next-refresh' }),
      );
    }
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const next = initial.shift();
      if (next !== undefined) return next;
      const signal = init?.signal;
      if (signal === undefined || signal === null) throw new Error('Request has no signal');
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            streams.push(controller);
            controller.enqueue(new TextEncoder().encode(binary ? 'partial' : '{"partial":'));
            signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
          },
        }),
        {
          status,
          headers: { 'content-type': binary ? 'image/png' : 'application/json' },
        },
      );
    });
    const client = new ApiClient({
      baseUrl: 'https://api.test',
      defaultTimeoutMs: 30,
      networkRetry: { attempts: 1, baseDelayMs: 0 },
      tokens,
      fetch,
      logger: { debug: () => undefined, warn: () => undefined },
    });
    return { client, fetch };
  }

  const cases = [
    { label: 'JSON', status: 200, binary: false, auth: 'none', retry: false },
    { label: 'binary', status: 200, binary: true, auth: 'none', retry: false },
    { label: 'HTTP error', status: 400, binary: false, auth: 'none', retry: false },
    { label: '401 before refresh', status: 401, binary: false, auth: 'required', retry: false },
    { label: 'body after refresh', status: 200, binary: false, auth: 'required', retry: true },
  ] as const;

  describe.each(cases)('$label', ({ status, binary, auth, retry }) => {
    it.each(['timeout', 'aborted'] as const)(
      'settles with %s after headers while the body is incomplete',
      async (kind) => {
        const { client, fetch } = createStreamingClient(status, binary, retry);
        const caller = new AbortController();
        const spec = {
          method: 'GET',
          path: '/stream',
          auth,
          idempotent: true,
          signal: caller.signal,
        } as const;
        const results: unknown[] = [];
        const pending = (
          binary
            ? client.binary({ ...spec, contentType: 'image/png' })
            : client.json({ ...spec, decode: (value) => value })
        ).then(
          (value) => results.push(value),
          (error: unknown) => results.push(error),
        );

        await vi.advanceTimersByTimeAsync(0);
        expect(streams).toHaveLength(1);
        expect(results).toEqual([]);
        if (kind === 'aborted') caller.abort();
        else await vi.advanceTimersByTimeAsync(30);
        await vi.advanceTimersByTimeAsync(0);

        try {
          expect(results).toEqual([expect.objectContaining({ kind, path: '/stream' })]);
          expect(fetch).toHaveBeenCalledTimes(retry ? 3 : 1);
        } finally {
          for (const stream of streams) stream.error(new Error('End incomplete body'));
          await pending;
        }
      },
    );
  });

  it.each(['complete', 'broken'] as const)(
    'releases fallback listeners when the body is %s',
    async (outcome) => {
      const { client, fetch } = createStreamingClient(200);
      const caller = new AbortController();
      const remove = vi.spyOn(caller.signal, 'removeEventListener');
      const pending = client.json({
        method: 'GET',
        path: '/stream',
        auth: 'none',
        idempotent: true,
        signal: caller.signal,
        decode: (value) => value,
      });
      const settled = pending.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(0);
      expect(remove).not.toHaveBeenCalled();
      for (const stream of streams) {
        if (outcome === 'broken') stream.error(new TypeError('Stream disconnected'));
        else {
          stream.enqueue(new TextEncoder().encode('true}'));
          stream.close();
        }
      }
      const result: unknown = await settled;
      if (outcome === 'broken') expect(result).toMatchObject({ kind: 'network' });
      else expect(result).toEqual({ partial: true });
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});
