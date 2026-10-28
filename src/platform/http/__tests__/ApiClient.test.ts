import { ApiError } from '@/platform/http/ApiError';
import {
  createTestApiClient,
  createUnsignedAccessToken,
  jsonResponse,
} from '@/test-utils/httpClient';

const FRESH_EXP = Math.floor(Date.now() / 1000) + 3600;
const EXPIRED_EXP = Math.floor(Date.now() / 1000) - 60;

describe('ApiClient', () => {
  it('sends the bearer token, JSON body and decodes the response', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.saveTokens(createUnsignedAccessToken('u1', FRESH_EXP), 'refresh');
    network.respond(() => jsonResponse(200, { ok: true }));

    const result = await client.json({
      method: 'POST',
      path: '/thing',
      auth: 'required',
      idempotent: false,
      body: { a: 1 },
      decode: (value) => value as { ok: boolean },
    });

    expect(result).toEqual({ ok: true });
    expect(network.requests[0]).toMatchObject({
      url: 'https://api.test/thing',
      method: 'POST',
      body: '{"a":1}',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });
  });

  it('throws an http ApiError with the server reason for non-2xx', async () => {
    const { client, network } = createTestApiClient();
    network.respond(() => jsonResponse(400, { reason: 'INSUFFICIENT_SHARDS' }));

    const error = await client
      .json({ method: 'GET', path: '/x', auth: 'none', idempotent: true, decode: (v) => v })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 400, reason: 'INSUFFICIENT_SHARDS' });
  });

  it('classifies a 2xx body that fails the decoder as a contract error', async () => {
    const { client, network } = createTestApiClient();
    network.respond(() => jsonResponse(200, { unexpected: true }));

    await expect(
      client.json({
        method: 'GET',
        path: '/x',
        auth: 'none',
        idempotent: true,
        decode: () => {
          throw new Error('bad shape');
        },
      }),
    ).rejects.toMatchObject({ kind: 'contract', status: 200 });
  });

  it('retries fetch failures only for idempotent requests', async () => {
    const { client, network } = createTestApiClient({ networkRetryAttempts: 1 });
    network.respond(() => new TypeError('Failed to fetch'));
    network.respond(() => jsonResponse(200, 1));
    await expect(
      client.json({ method: 'GET', path: '/x', auth: 'none', idempotent: true, decode: (v) => v }),
    ).resolves.toBe(1);
    expect(network.requests).toHaveLength(2);

    network.respond(() => new TypeError('Failed to fetch'));
    await expect(
      client.json({
        method: 'POST',
        path: '/y',
        auth: 'none',
        idempotent: false,
        decode: (v) => v,
      }),
    ).rejects.toMatchObject({ kind: 'network' });
    expect(network.requests).toHaveLength(3);
  });

  it('refreshes once on 401 and retries with the rotated token', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.saveTokens(createUnsignedAccessToken('u1', FRESH_EXP), 'old-refresh');
    const rotated = createUnsignedAccessToken('u1', FRESH_EXP + 10);
    network.respond(() => jsonResponse(401, { reason: 'TOKEN_EXPIRED' }));
    network.respond(() =>
      jsonResponse(200, { access_token: rotated, refresh_token: 'new-refresh' }),
    );
    network.respond(() => jsonResponse(200, 'done'));

    await expect(
      client.json({
        method: 'GET',
        path: '/me',
        auth: 'required',
        idempotent: true,
        decode: (v) => v,
      }),
    ).resolves.toBe('done');

    expect(network.requests.map((r) => r.url)).toEqual([
      'https://api.test/me',
      'https://api.test/auth/refresh',
      'https://api.test/me',
    ]);
    expect(network.requests[1]?.body).toBe('{"refresh_token":"old-refresh"}');
    expect(network.requests[2]?.headers.authorization).toBe(`Bearer ${rotated}`);
    expect(tokens.refreshToken).toBe('new-refresh');
  });

  it('expires the token store when the refresh token is rejected', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.saveTokens(createUnsignedAccessToken('u1', FRESH_EXP), 'dead-refresh');
    tokens.setSession({ userId: 'u1', initialUser: null });
    const expired = jest.fn();
    tokens.subscribeExpired(expired);
    network.respond(() => jsonResponse(401, { reason: 'TOKEN_EXPIRED' }));
    network.respond(() => jsonResponse(401, { reason: 'INVALID_REFRESH_TOKEN' }));

    await expect(
      client.json({
        method: 'GET',
        path: '/me',
        auth: 'required',
        idempotent: true,
        decode: (v) => v,
      }),
    ).rejects.toMatchObject({ kind: 'http', status: 401, reason: 'AUTH_EXPIRED' });

    expect(expired).toHaveBeenCalledTimes(1);
    expect(tokens.accessToken).toBeNull();
    expect(tokens.session).toBeNull();
  });

  it('surfaces the original 401 when refresh is offline', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.saveTokens(createUnsignedAccessToken('u1', FRESH_EXP), 'refresh');
    network.respond(() => jsonResponse(401, { reason: 'TOKEN_EXPIRED' }));
    network.respond(() => new TypeError('Failed to fetch'));

    await expect(
      client.json({
        method: 'GET',
        path: '/me',
        auth: 'required',
        idempotent: true,
        decode: (v) => v,
      }),
    ).rejects.toMatchObject({ kind: 'http', status: 401, reason: 'TOKEN_EXPIRED' });
    expect(tokens.refreshToken).toBe('refresh');
  });

  it('does not intercept 401 for passthrough or none auth', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.saveTokens(createUnsignedAccessToken('u1', FRESH_EXP), 'refresh');
    network.respond(() => jsonResponse(401, { reason: 'UNAUTHORIZED' }));
    await expect(
      client.json({
        method: 'GET',
        path: '/me',
        auth: 'passthrough',
        idempotent: true,
        decode: (v) => v,
      }),
    ).rejects.toMatchObject({ status: 401, reason: 'UNAUTHORIZED' });
    expect(network.requests).toHaveLength(1);
    expect(network.requests[0]?.headers.authorization).toBeDefined();

    network.respond(() => jsonResponse(401, { reason: 'INVALID_CREDENTIALS' }));
    await expect(
      client.json({
        method: 'POST',
        path: '/auth/signin',
        auth: 'none',
        idempotent: false,
        decode: (v) => v,
      }),
    ).rejects.toMatchObject({ status: 401, reason: 'INVALID_CREDENTIALS' });
    expect(network.requests[1]?.headers.authorization).toBeUndefined();
  });

  it('shares one refresh round trip between concurrent callers', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.saveTokens(createUnsignedAccessToken('u1', EXPIRED_EXP), 'refresh');
    const rotated = createUnsignedAccessToken('u1', FRESH_EXP);
    network.respond(() => jsonResponse(200, { access_token: rotated, refresh_token: 'r2' }));

    const [a, b] = await Promise.all([
      client.ensureFreshAccessToken(),
      client.ensureFreshAccessToken(),
    ]);

    expect(a).toBe(rotated);
    expect(b).toBe(rotated);
    expect(network.requests).toHaveLength(1);
  });

  it('aborts a request whose bound identity changes mid-flight', async () => {
    const { client, tokens, network } = createTestApiClient();
    tokens.setSession({ userId: 'u1', initialUser: null });
    network.respond(() => {
      tokens.setSession({ userId: 'u2', initialUser: null });
      return jsonResponse(200, 'late');
    });

    await expect(
      client.json({ method: 'GET', path: '/me', auth: 'none', idempotent: true, decode: (v) => v }),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('classifies a timed-out request as timeout, not aborted', async () => {
    const { client, network } = createTestApiClient();
    network.respond(() => new Promise<Response>(() => undefined));

    await expect(
      client.json({
        method: 'GET',
        path: '/slow',
        auth: 'none',
        idempotent: true,
        timeoutMs: 5,
        decode: (v) => v,
      }),
    ).rejects.toMatchObject({ kind: 'timeout' });
  });
});
