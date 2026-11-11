import {
  fetchRequestTraffic,
  fetchUserRewards,
  fetchUsers,
  getTimeRange,
  grantUserReward,
} from '@/features/admin/services/adminApi';
import { verifyAdminPassword } from '@/features/admin/services/adminAuth';
import { expireAdminSession } from '@/features/admin/services/adminCredentialStore';

vi.mock('@/features/admin/services/adminCredentialStore', () => ({
  readAdminCredential: vi.fn(() => 'credential'),
  expireAdminSession: vi.fn(),
}));

const mockFetch = vi.fn<(...args: [RequestInfo | URL, RequestInit?]) => Promise<Response>>();

describe('adminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it.each([401, 403])('treats status %s as an invalid credential', async (status) => {
    mockFetch.mockResolvedValue(new Response(null, { status }));
    await expect(verifyAdminPassword('credential')).resolves.toBe(false);
  });

  it('checks credentials with the no-content session endpoint, without a stats query', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(verifyAdminPassword('credential')).resolves.toBe(true);
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/admin\/session$/),
      expect.any(Object),
    );
  });

  it('sends cursor/search filters without offset pagination and decodes the next cursor', async () => {
    mockFetch.mockResolvedValue(Response.json({ users: [], nextCursor: 'next-page' }));
    await expect(fetchUsers({ q: 'player@example.com', cursor: 'current-page' })).resolves.toEqual({
      users: [],
      nextCursor: 'next-page',
    });
    const input = mockFetch.mock.calls[0]?.[0];
    if (typeof input !== 'string') throw new Error('Expected URL string');
    const url = new URL(input);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'player@example.com',
      cursor: 'current-page',
      sort: 'created_at',
      order: 'desc',
    });
  });

  it('revokes an expired session before surfacing a failed API request', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: false, reason: 'INVALID_ADMIN_TOKEN' }, { status: 403 }),
    );
    await expect(fetchUsers()).rejects.toThrow('INVALID_ADMIN_TOKEN');
    expect(expireAdminSession).toHaveBeenCalledOnce();
  });

  it('surfaces non-authentication failures instead of reporting a bad password', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, reason: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(verifyAdminPassword('credential')).rejects.toThrow(
      'Admin API 500: INTERNAL_ERROR',
    );
  });

  it('rejects non-canonical credential input before making a request', async () => {
    await expect(verifyAdminPassword(' credential ')).rejects.toThrow('trimmed non-empty string');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches request traffic for the exact selected time range', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
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
            commandRequests: 0,
            stateUpdateBroadcasts: 0,
            stateUpdateDeliveries: 0,
            stateUpdateBytes: 0,
            downlinkDeliveries: 0,
            downlinkBytes: 0,
            invalidClientMessages: 0,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      fetchRequestTraffic('2026-08-31T00:00:00Z', '2026-08-31T00:02:00Z'),
    ).resolves.toMatchObject({
      platform: { requests: 0 },
    });
    const requestInput = mockFetch.mock.calls[0]?.[0];
    if (requestInput === undefined) throw new Error('Expected one Admin API request');
    const requestUrl =
      typeof requestInput === 'string'
        ? new URL(requestInput)
        : requestInput instanceof URL
          ? requestInput
          : new URL(requestInput.url);
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
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(grant)));
    await expect(grantUserReward('recipient', input)).resolves.toEqual(grant);
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/admin/users/recipient/rewards'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'X-Admin-Token': 'credential', 'Content-Type': 'application/json' },
      }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ normalDraws: 0, goldenDraws: 105, grants: [grant] })),
    );
    await expect(fetchUserRewards('recipient')).resolves.toMatchObject({
      goldenDraws: 105,
      grants: [grant],
    });
  });
});
