/**
 * useStageDeadline dispatch discipline (AU-25/AU-26): with a past
 * deadline, an in-flight dispatch must never be duplicated by later
 * ticks, and a closed guard must suppress dispatch entirely. A phase
 * identity (`attemptKey`) is attempted at most once and never retried
 * after any outcome. The guard models the session snapshot conditions
 * (pending command / moved revision) the five game callers pass in.
 */
import { act, renderHook } from '@testing-library/react-native';

import { handleError } from '@/utils/errorPipeline';

import { useStageDeadline } from '../useStageDeadline';

jest.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
}));

jest.mock('@/utils/errorPipeline', () => ({
  handleError: jest.fn(),
}));

describe('useStageDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('dispatches once while the expiry command is in flight', async () => {
    const onExpire = jest.fn(() => new Promise<unknown>(() => {}));
    const shouldExpire = () => true;
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        attemptKey: 'round-1:1:1000',
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('never dispatches while the snapshot guard is closed', async () => {
    const onExpire = jest.fn(async () => undefined);
    const shouldExpire = () => false;
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        attemptKey: 'round-1:1:1000',
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('reports no countdown without a deadline', () => {
    const { result } = renderHook(() =>
      useStageDeadline({
        deadlineAt: null,
        shouldExpire: () => true,
        onExpire: async () => undefined,
        label: '推进阶段',
        attemptKey: null,
      }),
    );
    expect(result.current.remainingSeconds).toBeNull();
  });
});

describe('useStageDeadline silentExpire (AU-26)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(handleError).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs once and never retries the same attempt key instead of alerting', async () => {
    const onExpire = jest.fn(async () => {
      throw new Error('dispatch blew up');
    });
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire: () => true,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        silentExpire: true,
        attemptKey: 'round-1:1:1000',
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(handleError).not.toHaveBeenCalled();
  });

  it('does not retry a committed attempt key either', async () => {
    const onExpire = jest.fn(async () => undefined);
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire: () => true,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        attemptKey: 'round-1:1:1000',
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('dispatches again when the attempt key changes', async () => {
    const onExpire = jest.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ attemptKey }: { attemptKey: string }) =>
        useStageDeadline({
          deadlineAt: Date.now() - 1000,
          shouldExpire: () => true,
          onExpire,
          label: '推进阶段',
          refreshIntervalMs: 250,
          attemptKey,
        }),
      { initialProps: { attemptKey: 'round-1:1:1000' } },
    );
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    rerender({ attemptKey: 'round-1:2:2000' });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  it('never dispatches for a null attempt key', async () => {
    const onExpire = jest.fn(async () => undefined);
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire: () => true,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        attemptKey: null,
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('does not re-attempt the same key after the epoch ends and returns', async () => {
    const onExpire = jest.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ deadlineAt }: { deadlineAt: number | null }) =>
        useStageDeadline({
          deadlineAt,
          shouldExpire: () => true,
          onExpire,
          label: '推进阶段',
          refreshIntervalMs: 250,
          attemptKey: 'round-1:1:1000',
        }),
      { initialProps: { deadlineAt: Date.now() - 1000 } },
    );
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    rerender({ deadlineAt: null });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    rerender({ deadlineAt: Date.now() - 1000 });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('alerts once through handleError and does not retry with an attempt key', async () => {
    const onExpire = jest.fn(async () => {
      throw new Error('dispatch blew up');
    });
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire: () => true,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        attemptKey: 'round-1:1:1000',
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledTimes(1);
  });

  it('alerts through handleError when silentExpire is not set', async () => {
    const onExpire = jest.fn(async () => {
      throw new Error('dispatch blew up');
    });
    renderHook(() =>
      useStageDeadline({
        deadlineAt: Date.now() - 1000,
        shouldExpire: () => true,
        onExpire,
        label: '推进阶段',
        refreshIntervalMs: 250,
        attemptKey: 'round-1:1:1000',
      }),
    );
    // One attempt → one alert; the same key is never retried.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledTimes(1);
  });
});
