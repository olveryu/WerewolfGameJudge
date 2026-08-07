import { storage } from '@/services/infra/localStorage';

import { CFAuthService } from '../CFAuthService';
import {
  cfGet,
  cfPost,
  CloudflareHttpError,
  CloudflareResponseJsonError,
  CloudflareResponseProtocolError,
} from '../cfFetch';

jest.mock('../cfFetch', () => {
  const actual = jest.requireActual<typeof import('../cfFetch')>('../cfFetch');
  return {
    ...actual,
    cfGet: jest.fn(),
    cfPost: jest.fn(),
    cfPut: jest.fn(),
    setOnAuthExpired: jest.fn(),
    setRefreshHandler: jest.fn(),
    setTokenProvider: jest.fn(),
  };
});

const mockCfGet = jest.mocked(cfGet);
const mockCfPost = jest.mocked(cfPost);

const USER_METADATA = {
  display_name: null,
  avatar_url: null,
  custom_avatar_url: null,
  avatar_frame: null,
  seat_flair: null,
  name_style: null,
  equipped_effect: null,
  seat_animation: null,
} as const;

function createUnsignedAccessToken(userId: string, expiresAtSeconds: number): string {
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

function seedStoredSession(accessToken: string): void {
  storage.set('cf_auth_token', accessToken);
  storage.set('cf_refresh_token', 'stored-refresh');
  storage.set('cf_auth_user_id', 'user-1');
  storage.set('cf_auth_is_anonymous', true);
  storage.set('cf_auth_has_wechat', false);
}

describe('CFAuthService session restore', () => {
  beforeEach(() => {
    storage.clearAll();
    mockCfGet.mockReset();
    mockCfPost.mockReset();
  });

  it('restores the persisted principal when refresh is offline', async () => {
    const expiredToken = createUnsignedAccessToken('user-1', Math.floor(Date.now() / 1000) - 60);
    seedStoredSession(expiredToken);
    mockCfPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const service = new CFAuthService();
    await service.waitForInit();

    expect(service.getCurrentUserId()).toBe('user-1');
    expect(storage.getString('cf_auth_token')).toBe(expiredToken);
    expect(mockCfGet).not.toHaveBeenCalled();
  });

  it('clears the session when the refresh token is rejected', async () => {
    seedStoredSession(createUnsignedAccessToken('user-1', Math.floor(Date.now() / 1000) - 60));
    mockCfPost.mockRejectedValueOnce(
      new CloudflareHttpError({
        status: 401,
        reason: 'INVALID_REFRESH_TOKEN',
        body: { success: false, reason: 'INVALID_REFRESH_TOKEN' },
      }),
    );

    const service = new CFAuthService();
    await service.waitForInit();

    expect(service.getCurrentUserId()).toBeNull();
    expect(storage.getString('cf_auth_token')).toBeUndefined();
    expect(storage.getBoolean('cf_auth_is_anonymous')).toBeUndefined();
    expect(mockCfGet).not.toHaveBeenCalled();
  });

  it('verifies and caches the canonical user after a successful refresh', async () => {
    seedStoredSession(createUnsignedAccessToken('user-1', Math.floor(Date.now() / 1000) - 60));
    const refreshedToken = createUnsignedAccessToken(
      'user-1',
      Math.floor(Date.now() / 1000) + 3600,
    );
    mockCfPost.mockImplementationOnce(async (_path, _body, decode) =>
      decode({ access_token: refreshedToken, refresh_token: 'rotated-refresh' }),
    );
    mockCfGet.mockImplementationOnce(async (_path, decode) =>
      decode({
        data: {
          user: {
            id: 'user-1',
            email: null,
            is_anonymous: true,
            has_wechat: false,
            user_metadata: USER_METADATA,
          },
        },
      }),
    );

    const service = new CFAuthService();
    await service.waitForInit();

    expect(service.getCurrentUserId()).toBe('user-1');
    expect(storage.getString('cf_auth_token')).toBe(refreshedToken);
    expect(storage.getString('cf_refresh_token')).toBe('rotated-refresh');
    expect(mockCfGet).toHaveBeenCalledWith('/auth/user', expect.any(Function), {
      skipAuthIntercept: true,
      noRetry: true,
    });
  });

  it.each(['body-read', 'json-parse'] as const)(
    'retries refresh once when JSON production fails during %s',
    async (phase) => {
      seedStoredSession(createUnsignedAccessToken('user-1', Math.floor(Date.now() / 1000) - 60));
      const refreshedToken = createUnsignedAccessToken(
        'user-1',
        Math.floor(Date.now() / 1000) + 3600,
      );
      mockCfPost
        .mockRejectedValueOnce(
          new CloudflareResponseJsonError({
            path: '/auth/refresh',
            status: 200,
            phase,
            cause: new TypeError('body stream terminated'),
          }),
        )
        .mockImplementationOnce(async (_path, _body, decode) =>
          decode({ access_token: refreshedToken, refresh_token: 'replayed-refresh' }),
        );
      mockCfGet.mockImplementationOnce(async (_path, decode) =>
        decode({
          data: {
            user: {
              id: 'user-1',
              email: null,
              is_anonymous: true,
              has_wechat: false,
              user_metadata: USER_METADATA,
            },
          },
        }),
      );

      const service = new CFAuthService();
      await service.waitForInit();

      expect(mockCfPost).toHaveBeenCalledTimes(2);
      expect(storage.getString('cf_auth_token')).toBe(refreshedToken);
      expect(storage.getString('cf_refresh_token')).toBe('replayed-refresh');
    },
  );

  it('does not retry a refresh response rejected by its decoder', async () => {
    seedStoredSession(createUnsignedAccessToken('user-1', Math.floor(Date.now() / 1000) - 60));
    mockCfPost.mockRejectedValueOnce(
      new CloudflareResponseProtocolError({
        path: '/auth/refresh',
        status: 200,
        body: { access_token: 'missing-refresh-token' },
      }),
    );

    const service = new CFAuthService();
    await service.waitForInit();

    expect(mockCfPost).toHaveBeenCalledTimes(1);
    expect(storage.getString('cf_refresh_token')).toBe('stored-refresh');
  });

  it('does not invent an offline identity for malformed persisted state', async () => {
    seedStoredSession('not-a-jwt');
    mockCfPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const service = new CFAuthService();
    await service.waitForInit();

    expect(service.getCurrentUserId()).toBeNull();
    expect(storage.getString('cf_auth_token')).toBeUndefined();
  });
});
