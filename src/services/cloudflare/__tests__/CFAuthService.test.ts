import { storage } from '@/services/infra/localStorage';
import {
  createTestApiClient,
  createUnsignedAccessToken,
  jsonResponse,
} from '@/test-utils/httpClient';

import { CFAuthService } from '../CFAuthService';

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

const ANONYMOUS_USER = {
  id: 'user-1',
  email: null,
  is_anonymous: true,
  has_wechat: false,
  user_metadata: USER_METADATA,
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function seedStoredPrincipal(): void {
  storage.set('cf_auth_user_id', 'user-1');
  storage.set('cf_auth_is_anonymous', true);
  storage.set('cf_auth_has_wechat', false);
}

/** Responses must be queued before construction: the constructor starts auto sign-in. */
function createService(
  accessToken: string | null,
  queueResponses: (network: ReturnType<typeof createTestApiClient>['network']) => void = () =>
    undefined,
) {
  const harness = createTestApiClient();
  if (accessToken !== null) harness.tokens.saveTokens(accessToken, 'stored-refresh');
  queueResponses(harness.network);
  const service = new CFAuthService({ apiClient: harness.client, tokens: harness.tokens });
  return { ...harness, service };
}

describe('CFAuthService session restore', () => {
  beforeEach(() => {
    storage.clearAll();
  });

  it('restores the persisted principal when refresh is offline', async () => {
    const expiredToken = createUnsignedAccessToken('user-1', nowSeconds() - 60);
    seedStoredPrincipal();
    const { service, tokens, network } = createService(expiredToken, (network) =>
      network.respond(() => new TypeError('Failed to fetch')),
    );

    await service.waitForInit();

    expect(service.getCurrentUserId()).toBe('user-1');
    expect(service.getAuthSession()).toEqual({ userId: 'user-1', initialUser: null });
    expect(tokens.accessToken).toBe(expiredToken);
    expect(network.requests.map((r) => r.url)).toEqual(['https://api.test/auth/refresh']);
  });

  it('clears the session when the refresh token is rejected', async () => {
    seedStoredPrincipal();
    const { service, tokens, network } = createService(
      createUnsignedAccessToken('user-1', nowSeconds() - 60),
      (network) => network.respond(() => jsonResponse(401, { reason: 'INVALID_REFRESH_TOKEN' })),
    );

    await service.waitForInit();

    expect(service.getCurrentUserId()).toBeNull();
    expect(tokens.accessToken).toBeNull();
    expect(storage.getBoolean('cf_auth_is_anonymous')).toBeUndefined();
    expect(network.requests).toHaveLength(1);
  });

  it('publishes login and logout without an additional profile request', async () => {
    const { service, network } = createService(null);
    await service.waitForInit();
    const listener = jest.fn();
    const unsubscribe = service.subscribeAuth(listener);
    const user = { ...ANONYMOUS_USER, email: 'user@example.com', is_anonymous: false };
    network.respond(() =>
      jsonResponse(200, { user, access_token: 'access', refresh_token: 'refresh' }),
    );

    await service.signInWithEmail('user@example.com', 'password');

    const session = service.getAuthSession();
    expect(session).toEqual({ userId: 'user-1', initialUser: user });
    expect(service.getAuthSession()).toBe(session);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(network.requests.map((r) => r.url)).toEqual(['https://api.test/auth/signin']);

    network.respond(() => jsonResponse(200, { success: true }));
    await service.signOut();

    expect(service.getAuthSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('verifies and caches the canonical user after a successful refresh', async () => {
    seedStoredPrincipal();
    const refreshedToken = createUnsignedAccessToken('user-1', nowSeconds() + 3600);
    const { service, tokens, network } = createService(
      createUnsignedAccessToken('user-1', nowSeconds() - 60),
      (network) => {
        network.respond(() =>
          jsonResponse(200, { access_token: refreshedToken, refresh_token: 'rotated-refresh' }),
        );
        network.respond(() => jsonResponse(200, { data: { user: ANONYMOUS_USER } }));
      },
    );

    await service.waitForInit();

    expect(service.getCurrentUserId()).toBe('user-1');
    expect(tokens.accessToken).toBe(refreshedToken);
    expect(tokens.refreshToken).toBe('rotated-refresh');
    expect(network.requests[1]).toMatchObject({
      url: 'https://api.test/auth/user',
      headers: { Authorization: `Bearer ${refreshedToken}` },
    });
  });

  it('falls back to refresh when a locally fresh token is rejected online', async () => {
    seedStoredPrincipal();
    const refreshedToken = createUnsignedAccessToken('user-1', nowSeconds() + 7200);
    const { service, network } = createService(
      createUnsignedAccessToken('user-1', nowSeconds() + 3600),
      (network) => {
        network.respond(() => jsonResponse(401, { reason: 'TOKEN_REVOKED' }));
        network.respond(() =>
          jsonResponse(200, { access_token: refreshedToken, refresh_token: 'rotated' }),
        );
        network.respond(() => jsonResponse(200, { data: { user: ANONYMOUS_USER } }));
      },
    );

    await service.waitForInit();

    expect(service.getCurrentUserId()).toBe('user-1');
    expect(network.requests.map((r) => r.url)).toEqual([
      'https://api.test/auth/user',
      'https://api.test/auth/refresh',
      'https://api.test/auth/user',
    ]);
  });

  it('does not invent an offline identity for malformed persisted state', async () => {
    seedStoredPrincipal();
    const { service, tokens } = createService('not-a-jwt', (network) =>
      network.respond(() => new TypeError('Failed to fetch')),
    );

    await service.waitForInit();

    expect(service.getCurrentUserId()).toBeNull();
    expect(tokens.accessToken).toBeNull();
  });

  it('notifies auth-expired listeners when a required request proves the session dead', async () => {
    seedStoredPrincipal();
    const { service, network } = createService(
      createUnsignedAccessToken('user-1', nowSeconds() + 3600),
      (network) => network.respond(() => jsonResponse(200, { data: { user: ANONYMOUS_USER } })),
    );
    await service.waitForInit();
    const expired = jest.fn();
    service.onAuthExpired(expired);

    network.respond(() => jsonResponse(401, { reason: 'TOKEN_EXPIRED' }));
    network.respond(() => jsonResponse(401, { reason: 'INVALID_REFRESH_TOKEN' }));
    await expect(service.getCurrentUser()).rejects.toMatchObject({ reason: 'AUTH_EXPIRED' });

    expect(expired).toHaveBeenCalledTimes(1);
    expect(service.getAuthSession()).toBeNull();
    expect(storage.getString('cf_auth_user_id')).toBeUndefined();
  });
});
