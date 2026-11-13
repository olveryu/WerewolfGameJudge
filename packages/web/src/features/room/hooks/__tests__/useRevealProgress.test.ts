/** Two clients seek to the same server timeline, including after a hidden tab or reconnect. */

import { act, renderHook } from '@testing-library/react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import type { ServerClock } from '@/services/serverClock';

import { type RevealTiming, useRevealProgress } from '../useRevealProgress';

vi.mock('@/features/product/hooks/useAppVisibility', () => ({ useAppVisibility: vi.fn() }));
vi.mock('@/scene/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: vi.fn() }));

const timing = { revealStartedAt: 1_000, revealDurationMs: 2_000 };
let nowMs: number;
const clock: ServerClock = { nowMs: () => nowMs };

beforeEach(() => {
  vi.useFakeTimers();
  nowMs = 1_500;
  vi.mocked(useAppVisibility).mockReturnValue(true);
  vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
});
afterEach(() => {
  vi.useRealTimers();
});

it('seeks to elapsed server time instead of starting again for a late client', () => {
  const first = renderHook(() => useRevealProgress(timing, clock));
  expect(first.result.current).toBe(0.25);
  nowMs = 2_000;
  const late = renderHook(() => useRevealProgress(timing, clock));
  act(() => {
    vi.advanceTimersByTime(20);
  });
  expect(first.result.current).toBe(0.5);
  expect(late.result.current).toBe(first.result.current);
  nowMs = 5_000;
  act(() => {
    vi.advanceTimersByTime(20);
  });
  expect(first.result.current).toBe(1);
  expect(late.result.current).toBe(1);
});

it('stops in the background and catches up on return without replaying missed frames', () => {
  const { result, rerender } = renderHook(() => useRevealProgress(timing, clock));
  vi.mocked(useAppVisibility).mockReturnValue(false);
  rerender();
  nowMs = 2_800;
  act(() => {
    vi.advanceTimersByTime(1_000);
  });
  expect(result.current).toBe(0.25);
  vi.mocked(useAppVisibility).mockReturnValue(true);
  rerender();
  expect(result.current).toBe(0.9);
});

it('waits for calibration but shows complete content for old entries and reduced motion', () => {
  const props: { timing: RevealTiming | null; clock: ServerClock | null } = {
    timing,
    clock: null,
  };
  const { result, rerender } = renderHook(() => useRevealProgress(props.timing, props.clock));
  expect(result.current).toBe(0);
  props.clock = clock;
  rerender();
  expect(result.current).toBe(0.25);
  props.timing = null;
  rerender();
  expect(result.current).toBe(1);
  props.timing = timing;
  vi.mocked(usePrefersReducedMotion).mockReturnValue(true);
  rerender();
  expect(result.current).toBe(1);
});
