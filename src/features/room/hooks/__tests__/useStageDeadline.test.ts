/**
 * useStageDeadline countdown (D3): the hook is display-only. It derives
 * remaining seconds from the armed deadline and the room clock and never
 * dispatches anything — stage deadlines are settled server-side. These
 * cases pin the remaining countdown contract: null without a deadline,
 * whole seconds while counting down, 0 once reached.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useStageDeadline } from '../useStageDeadline';

jest.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
}));

describe('useStageDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports no countdown without a deadline', () => {
    const { result } = renderHook(() => useStageDeadline({ deadlineAt: null }));
    expect(result.current.remainingSeconds).toBeNull();
  });

  it('counts whole seconds down to zero', () => {
    const { result } = renderHook(() =>
      useStageDeadline({ deadlineAt: 15_000, refreshIntervalMs: 250 }),
    );
    expect(result.current.remainingSeconds).toBe(5);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(3);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('reports zero once the deadline has passed', () => {
    const { result } = renderHook(() => useStageDeadline({ deadlineAt: 9_000 }));
    expect(result.current.remainingSeconds).toBe(0);
  });
});
