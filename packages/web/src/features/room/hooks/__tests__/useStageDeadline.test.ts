/**
 * useStageDeadline countdown (D3): the hook is display-only. It derives
 * remaining seconds from the armed deadline and the room clock and never
 * dispatches anything — stage deadlines are settled server-side. These
 * cases pin the remaining countdown contract: null without a deadline,
 * whole seconds while counting down, 0 once reached — and the overdue
 * flag (D3 follow-up): false without a deadline, while counting down,
 * and within the 5-second grace after the deadline; true once the grace
 * has elapsed.
 */
import { act, renderHook } from '@testing-library/react';

import { useStageDeadline } from '../useStageDeadline';

vi.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
}));

describe('useStageDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });
  afterEach(() => {
    vi.useRealTimers();
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
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(3);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('reports zero once the deadline has passed', () => {
    const { result } = renderHook(() => useStageDeadline({ deadlineAt: 9_000 }));
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('is not overdue without a deadline', () => {
    const { result } = renderHook(() => useStageDeadline({ deadlineAt: null }));
    expect(result.current.isOverdue).toBe(false);
  });

  it('is not overdue while counting down', () => {
    const { result } = renderHook(() =>
      useStageDeadline({ deadlineAt: 15_000, refreshIntervalMs: 250 }),
    );
    expect(result.current.isOverdue).toBe(false);
  });

  it('is not overdue within the grace after the deadline', () => {
    const { result } = renderHook(() =>
      useStageDeadline({ deadlineAt: 9_000, refreshIntervalMs: 250 }),
    );
    // nowMs is 10_000: 1s past the deadline, inside the 5s grace.
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isOverdue).toBe(false);
  });

  it('is overdue once the grace has elapsed', () => {
    const { result } = renderHook(() =>
      useStageDeadline({ deadlineAt: 9_000, refreshIntervalMs: 250 }),
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // nowMs is 14_000: 5s past the deadline, grace elapsed.
    expect(result.current.isOverdue).toBe(true);
  });
});
