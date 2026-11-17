import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useSpotmatchCooldown } from '../hooks/useSpotmatchCooldown';

afterEach(() => vi.useRealTimers());

it('unlocks at the authority deadline, not another second after receiving the snapshot', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const hook = renderHook(({ until }) => useSpotmatchCooldown(until), {
    initialProps: { until: 0 },
  });
  await act(() => vi.advanceTimersByTime(600));
  hook.rerender({ until: 2000 });
  expect(hook.result.current).toBe(true);
  await act(() => vi.advanceTimersByTime(399));
  expect(hook.result.current).toBe(true);
  await act(() => vi.advanceTimersByTime(1));
  expect(hook.result.current).toBe(false);
});

it('does not stay locked when a delayed wrong-result snapshot arrives after expiry', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const hook = renderHook(({ until }) => useSpotmatchCooldown(until), {
    initialProps: { until: 0 },
  });
  await act(() => vi.advanceTimersByTime(5000));
  hook.rerender({ until: 3000 });
  await act(() => vi.runOnlyPendingTimers());
  expect(hook.result.current).toBe(false);
});
