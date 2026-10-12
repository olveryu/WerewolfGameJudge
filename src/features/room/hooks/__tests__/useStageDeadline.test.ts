/**
 * useStageDeadline dispatch discipline (AU-25): with a past deadline,
 * an in-flight dispatch must never be duplicated by later ticks, and
 * a closed guard must suppress dispatch entirely. The guard models
 * the session snapshot conditions (pending command / moved revision)
 * the four game callers pass in.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useStageDeadline } from '../useStageDeadline';

jest.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
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
      }),
    );
    expect(result.current).toBeNull();
  });
});
