/**
 * adminApi — JWT-backed admin client tests.
 *
 * The admin portal authenticates via the app JWT system (cfGet/cfPost);
 * the standalone admin password and X-Admin-Token header are gone.
 * Transport failures surface as AdminApiError with the worker's status/reason.
 */
import {
  AdminApiError,
  fetchRequestTraffic,
  getAdminWhoAmI,
  getTimeRange,
  grantUserReward,
  setUserAdmin,
} from '@/features/admin/services/adminApi';
import { cfGet, cfPost, CloudflareHttpError } from '@/services/cloudflare/cfFetch';

jest.mock('@/services/cloudflare/cfFetch', () => {
  const actual = jest.requireActual<typeof import('@/services/cloudflare/cfFetch')>(
    '@/services/cloudflare/cfFetch',
  );
  return { ...actual, cfGet: jest.fn(), cfPost: jest.fn() };
});

const mockCfGet = jest.mocked(cfGet);
const mockCfPost = jest.mocked(cfPost);

describe('adminApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks admin identity through the JWT-backed whoami endpoint', async () => {
    mockCfGet.mockResolvedValue({ userId: 'u1', isSuperAdmin: true });
    await expect(getAdminWhoAmI()).resolves.toEqual({ userId: 'u1', isSuperAdmin: true });
    expect(mockCfGet).toHaveBeenCalledWith('/admin/whoami', expect.any(Function), {
      signal: undefined,
    });
  });

  it('grants and revokes admin rights through the super-admin endpoint', async () => {
    mockCfPost.mockResolvedValue({ success: true, id: 'target', isAdmin: true });
    await expect(setUserAdmin('target', true)).resolves.toEqual({
      success: true,
      id: 'target',
      isAdmin: true,
    });
    expect(mockCfPost).toHaveBeenCalledWith(
      '/admin/users/target/admin',
      { isAdmin: true },
      expect.any(Function),
      { signal: undefined },
    );
  });

  it('normalizes transport failures into AdminApiError', async () => {
    mockCfGet.mockRejectedValue(
      new CloudflareHttpError({ status: 403, reason: 'FORBIDDEN', body: null }),
    );
    const error = await getAdminWhoAmI().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({ status: 403, reason: 'FORBIDDEN' });
  });

  it('passes non-HTTP failures through untouched', async () => {
    const failure = new Error('Network timeout');
    mockCfGet.mockRejectedValue(failure);
    await expect(getAdminWhoAmI()).rejects.toBe(failure);
  });

  it('fetches request traffic for the exact selected time range', async () => {
    mockCfGet.mockResolvedValue({
      generatedAt: '2026-08-31T00:02:00.000Z',
      platform: { requests: 0, errors: 0, subrequests: 0 },
      requestCountDelta: 0,
      http: {
        totalRequests: 0,
        clientErrorRequests: 0,
        serverErrorRequests: 0,
        successfulWebSocketConnections: 0,
        failedWebSocketConnections: 0,
        routes: [],
        series: [],
      },
      realtime: {
        stateSyncRequests: 0,
        stateUpdateBroadcasts: 0,
        stateUpdateDeliveries: 0,
        stateUpdateBytes: 0,
        downlinkDeliveries: 0,
        downlinkBytes: 0,
        invalidClientMessages: 0,
      },
    });

    await expect(
      fetchRequestTraffic('2026-08-31T00:00:00Z', '2026-08-31T00:02:00Z'),
    ).resolves.toMatchObject({
      platform: { requests: 0 },
    });
    const path = mockCfGet.mock.calls[0]?.[0] as string;
    const requestUrl = new URL(path, 'https://test.local');
    expect(requestUrl.pathname).toBe('/admin/request-traffic');
    expect(requestUrl.searchParams.get('from')).toBe('2026-08-31T00:00:00Z');
    expect(requestUrl.searchParams.get('to')).toBe('2026-08-31T00:02:00Z');
  });

  it.each([
    ['1h', 60 * 60 * 1_000],
    ['24h', 24 * 60 * 60 * 1_000],
  ] as const)('creates an exact trailing %s range', (preset, expectedDurationMs) => {
    const range = getTimeRange(preset);

    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(expectedDurationMs);
  });

  it('posts an exact reward identity and decodes balances and history', async () => {
    const input = {
      id: '99b71298-c798-49ad-bb47-dc54d21d2384',
      drawType: 'golden' as const,
      count: 100,
      reason: '活动奖励',
    };
    const grant = {
      ...input,
      userId: 'recipient',
      balanceBefore: 5,
      balanceAfter: 105,
      createdAt: '2026-09-18T00:00:00Z',
    };
    mockCfPost.mockResolvedValueOnce(grant);
    await expect(grantUserReward('recipient', input)).resolves.toEqual(grant);
    expect(mockCfPost).toHaveBeenLastCalledWith(
      '/admin/users/recipient/rewards',
      input,
      expect.any(Function),
    );
  });
});
