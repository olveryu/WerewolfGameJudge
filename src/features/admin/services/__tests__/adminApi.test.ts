import {
  fetchRequestTraffic,
  getTimeRange,
  verifyAdminPassword,
} from '@/features/admin/services/adminApi';

jest.mock('@/features/admin/services/adminCredentialStore', () => ({
  readAdminCredential: jest.fn(() => 'credential'),
}));

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

describe('adminApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it.each([401, 403])('treats status %s as an invalid credential', async (status) => {
    mockFetch.mockResolvedValue(new Response(null, { status }));
    await expect(verifyAdminPassword('credential')).resolves.toBe(false);
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
            stateUpdateBroadcasts: 0,
            stateUpdateDeliveries: 0,
            stateUpdateBytes: 0,
            downlinkDeliveries: 0,
            downlinkBytes: 0,
            userEventAcks: 0,
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
});
