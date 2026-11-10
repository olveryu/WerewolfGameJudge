/** Request traffic tab fetch cadence, manual-refresh, and range-race tests. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminRequestTraffic } from '@/features/admin/model/adminContracts';
import { fetchRequestTraffic } from '@/features/admin/services/adminApi';

import { RequestTrafficTab } from '../RequestTrafficTab';

vi.mock('@/features/admin/services/adminApi', () => ({
  fetchRequestTraffic: vi.fn(),
  getTimeRange: (preset: string) => ({ from: `from-${preset}`, to: `to-${preset}` }),
}));

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
  realtime: {
    stateSyncRequests: 0,
    stateUpdateBroadcasts: 0,
    stateUpdateDeliveries: 0,
    stateUpdateBytes: 0,
    downlinkDeliveries: 0,
    downlinkBytes: 0,
    invalidClientMessages: 0,
  },
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
  realtime: {
    ...EMPTY_TRAFFIC.realtime,
    stateUpdateBroadcasts: 3,
    stateUpdateDeliveries: 12,
    stateUpdateBytes: 2400,
    downlinkDeliveries: 17,
    downlinkBytes: 3300,
  },
};

const fetchRequestTrafficMock = vi.mocked(fetchRequestTraffic);

/** Settles the mocked fetch promises and the (timer-scheduled) query notifications. */
async function flushPromises() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RequestTrafficTab />
    </QueryClientProvider>,
  );
}

describe('RequestTrafficTab', () => {
  beforeEach(() => {
    fetchRequestTrafficMock.mockReset();
    fetchRequestTrafficMock.mockResolvedValue(EMPTY_TRAFFIC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads on entry, never polls, and refreshes only after explicit user intent', async () => {
    vi.useFakeTimers();
    renderTab();
    await flushPromises();
    expect(fetchRequestTrafficMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1_000);
    });
    expect(fetchRequestTrafficMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '刷新请求数据' }));
    await flushPromises();
    expect(fetchRequestTrafficMock).toHaveBeenCalledTimes(2);
    expect(fetchRequestTrafficMock).toHaveBeenLastCalledWith(
      'from-24h',
      'to-24h',
      expect.any(AbortSignal),
    );
  });

  it('aborts the earlier range and never lets its late response replace the newer one', async () => {
    let resolveFirst: (traffic: AdminRequestTraffic) => void = () => undefined;
    fetchRequestTrafficMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(TRAFFIC_WITH_ROUTE);
    renderTab();

    fireEvent.click(await screen.findByText('1小时'));
    expect(await screen.findByText('HTTP 4xx')).toBeDefined();
    const firstSignal = fetchRequestTrafficMock.mock.calls[0]?.[2];
    expect(firstSignal?.aborted).toBe(true);
    expect(fetchRequestTrafficMock).toHaveBeenLastCalledWith(
      'from-1h',
      'to-1h',
      expect.any(AbortSignal),
    );

    await act(async () => resolveFirst(EMPTY_TRAFFIC));
    expect(screen.getByText('12 · 60.0%')).toBeDefined();
  });

  it('keeps manual refresh available after the initial request fails', async () => {
    fetchRequestTrafficMock.mockRejectedValueOnce(new Error('provider unavailable'));
    renderTab();

    expect(await screen.findByText('请求监控加载失败，请重试')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '刷新请求数据' }));

    await waitFor(() => expect(fetchRequestTrafficMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('平台请求')).toBeDefined();
  });

  it('shows error classes, route share, status counts, and an honest zero-connection ratio', async () => {
    fetchRequestTrafficMock.mockResolvedValue(TRAFFIC_WITH_ROUTE);

    renderTab();

    expect(await screen.findByText('HTTP 4xx')).toBeDefined();
    expect(screen.getByText('HTTP 5xx')).toBeDefined();
    expect(screen.getByText('12 · 60.0%')).toBeDefined();
    expect(
      screen.getByText('200: 10  ·  500: 2', {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      }),
    ).toBeDefined();
    expect(screen.getByText('0 / 0（无成功连接，无法计算）')).toBeDefined();
    expect(screen.getByText('状态广播')).toBeDefined();
    expect(screen.getByText('状态推送帧')).toBeDefined();
    expect(screen.getByText('2.3 KB')).toBeDefined();
    expect(screen.getByText('全部下行帧')).toBeDefined();
    expect(screen.getByText('3.2 KB')).toBeDefined();
    expect(screen.getByText('1小时')).toBeDefined();
    expect(screen.getByText('24小时')).toBeDefined();
    expect(screen.queryByText('今天')).toBeNull();
    expect(screen.queryByText('自定义')).toBeNull();
  });
});
