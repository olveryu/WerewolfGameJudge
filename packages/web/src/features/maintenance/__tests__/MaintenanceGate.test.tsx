import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMaintenance,
  formatMaintenanceEnd,
  MAINTENANCE_POLL_MS,
  MAINTENANCE_QUERY_KEY,
} from '../maintenance';
import { MaintenanceGate } from '../MaintenanceGate';

vi.mock('../maintenance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../maintenance')>()),
  fetchMaintenance: vi.fn(),
}));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

const configuration = {
  enabled: true,
  message: '正在维护\n请稍后再来',
  endsAt: '2099-01-02T09:00:00+08:00',
};

function mountGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MaintenanceGate>
        <p>游戏内容</p>
      </MaintenanceGate>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('maintenance startup boundary', () => {
  it('does not mount player content before the status request completes', async () => {
    let resolveStatus: ((value: typeof configuration) => void) | undefined;
    vi.mocked(fetchMaintenance).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    );
    mountGate();
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
    await act(async () => resolveStatus?.({ ...configuration, enabled: false }));
    expect(await screen.findByText('游戏内容')).toBeInTheDocument();
  });

  it('shows editable text safely, blocks player content and restores after a status check', async () => {
    vi.mocked(fetchMaintenance)
      .mockResolvedValueOnce({ ...configuration, message: '<script>danger()</script>' })
      .mockResolvedValueOnce({ ...configuration, enabled: false });
    mountGate();
    expect(await screen.findByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
    expect(screen.getByText('<script>danger()</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '检查是否恢复' }));
    expect(await screen.findByText('游戏内容')).toBeInTheDocument();
  });

  it('checks status every minute and unmounts the player when maintenance starts', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchMaintenance)
      .mockResolvedValueOnce({ ...configuration, enabled: false })
      .mockResolvedValue(configuration);
    const { client } = mountGate();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText('游戏内容')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS);
    });
    expect(screen.getByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
    client.clear();
  });

  it('reports an initial status error without starting the player and allows retry', async () => {
    vi.mocked(fetchMaintenance)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ ...configuration, enabled: false });
    mountGate();
    expect(await screen.findByRole('alert')).toHaveTextContent('无法读取系统状态');
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('游戏内容')).toBeInTheDocument();
  });

  it('rechecks the server at the deadline instead of waiting for the minute poll', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const endsAt = '2030-01-01T00:00:02Z';
    vi.mocked(fetchMaintenance).mockImplementation(async () => ({
      ...configuration,
      endsAt,
      enabled: Date.now() < Date.parse(endsAt),
    }));
    const { client } = mountGate();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(screen.getByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(screen.getByText('游戏内容')).toBeInTheDocument();
    expect(fetchMaintenance).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('does not unlock on the client clock alone when the deadline status request fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    vi.mocked(fetchMaintenance)
      .mockResolvedValueOnce({ ...configuration, endsAt: '2030-01-01T00:00:02Z' })
      .mockRejectedValue(new Error('Unavailable'));
    const { client } = mountGate();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_001);
    });
    expect(screen.getByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('暂时无法检查');
    client.clear();
  });

  it('cancels the old deadline check when the administrator extends maintenance', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const extended = { ...configuration, endsAt: '2030-01-01T00:00:05Z' };
    vi.mocked(fetchMaintenance)
      .mockResolvedValueOnce({ ...configuration, endsAt: '2030-01-01T00:00:02Z' })
      .mockResolvedValue({ ...extended, enabled: false });
    const { client } = mountGate();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      client.setQueryData(MAINTENANCE_QUERY_KEY, extended);
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fetchMaintenance).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(fetchMaintenance).toHaveBeenCalledTimes(2);
    expect(screen.getByText('游戏内容')).toBeInTheDocument();
    client.clear();
  });

  it('preserves the maintenance announcement on a subsequent status failure', async () => {
    vi.mocked(fetchMaintenance)
      .mockResolvedValueOnce(configuration)
      .mockRejectedValueOnce(new Error('Unavailable'));
    const { client } = mountGate();
    expect(await screen.findByText(formatMaintenanceEnd(configuration.endsAt))).toBeInTheDocument();
    await act(async () => {
      await client.invalidateQueries({ queryKey: MAINTENANCE_QUERY_KEY });
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('暂时无法检查'));
    expect(screen.getByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
    expect(screen.queryByText('游戏内容')).not.toBeInTheDocument();
  });
});
