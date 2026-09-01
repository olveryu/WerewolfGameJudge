/** Request traffic tab fetch cadence and manual-refresh tests. */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { AdminRequestTraffic } from '@/features/admin/model/adminContracts';

import { RequestTrafficTab } from '../RequestTrafficTab';

const mockFetchRequestTraffic = jest.fn<Promise<AdminRequestTraffic>, [string, string]>();

jest.mock('@/features/admin/services/adminApi', () => ({
  fetchRequestTraffic: (from: string, to: string) => mockFetchRequestTraffic(from, to),
  getTimeRange: () => ({
    from: '2026-08-31T00:00:00.000Z',
    to: '2026-08-31T01:00:00.000Z',
  }),
}));

jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

const EMPTY_TRAFFIC: AdminRequestTraffic = {
  generatedAt: '2026-08-31T01:00:00.000Z',
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
  realtime: { stateSyncRequests: 0, userEventAcks: 0, invalidClientMessages: 0 },
};

const TRAFFIC_WITH_ROUTE: AdminRequestTraffic = {
  ...EMPTY_TRAFFIC,
  platform: { requests: 25, errors: 2, subrequests: 3 },
  requestCountDelta: 5,
  http: {
    ...EMPTY_TRAFFIC.http,
    totalRequests: 20,
    clientErrorRequests: 3,
    serverErrorRequests: 2,
    routes: [
      {
        method: 'POST',
        route: '/room/command',
        count: 12,
        errorCount: 2,
        avgDurationMs: 17,
        sharePercent: 60,
        statusCounts: [
          { status: 200, count: 10 },
          { status: 500, count: 2 },
        ],
      },
    ],
  },
};

describe('RequestTrafficTab', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchRequestTraffic.mockReset();
    mockFetchRequestTraffic.mockResolvedValue(EMPTY_TRAFFIC);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads on entry, never polls, and refreshes only after explicit user intent', async () => {
    render(<RequestTrafficTab />);

    await waitFor(() => expect(mockFetchRequestTraffic).toHaveBeenCalledTimes(1));
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1_000);
    });
    expect(mockFetchRequestTraffic).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText('刷新请求数据'));
    await waitFor(() => expect(mockFetchRequestTraffic).toHaveBeenCalledTimes(2));
    expect(mockFetchRequestTraffic).toHaveBeenLastCalledWith(
      '2026-08-31T00:00:00.000Z',
      '2026-08-31T01:00:00.000Z',
    );
  });

  it('keeps manual refresh available after the initial request fails', async () => {
    mockFetchRequestTraffic.mockRejectedValueOnce(new Error('provider unavailable'));
    render(<RequestTrafficTab />);

    await waitFor(() => expect(screen.getByText('请求监控加载失败，请重试')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('刷新请求数据'));

    await waitFor(() => expect(mockFetchRequestTraffic).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('平台请求')).toBeTruthy();
  });

  it('shows error classes, route share, status counts, and an honest zero-connection ratio', async () => {
    mockFetchRequestTraffic.mockResolvedValue(TRAFFIC_WITH_ROUTE);

    render(<RequestTrafficTab />);

    expect(await screen.findByText('HTTP 4xx')).toBeTruthy();
    expect(screen.getByText('HTTP 5xx')).toBeTruthy();
    expect(screen.getByText('12 · 60.0%')).toBeTruthy();
    expect(screen.getByText('200: 10  ·  500: 2')).toBeTruthy();
    expect(screen.getByText('0 / 0（无成功连接，无法计算）')).toBeTruthy();
    expect(screen.getByText('1小时')).toBeTruthy();
    expect(screen.getByText('24小时')).toBeTruthy();
    expect(screen.queryByText('今天')).toBeNull();
    expect(screen.queryByText('自定义')).toBeNull();
  });
});
