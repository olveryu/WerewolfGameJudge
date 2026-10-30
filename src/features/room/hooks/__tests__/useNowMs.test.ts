/**
 * useNowMs: one wall-clock ticker that only runs while active and
 * visible, and re-syncs to Date.now() on activation.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';

import { useNowMs } from '../useNowMs';

jest.mock('@/features/product/hooks/useAppVisibility', () => ({ useAppVisibility: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(10_000);
  jest.mocked(useAppVisibility).mockReturnValue(true);
});
afterEach(() => jest.useRealTimers());

describe('useNowMs', () => {
  it('ticks at the interval while active', () => {
    const { result } = renderHook(() => useNowMs(1000));
    expect(result.current).toBe(10_000);
    act(() => jest.advanceTimersByTime(2500));
    expect(result.current).toBe(12_000);
  });

  it('holds its value while inactive and re-syncs on activation', () => {
    let isActive = false;
    const { result, rerender } = renderHook(() => useNowMs(1000, isActive));
    act(() => jest.advanceTimersByTime(5000));
    expect(result.current).toBe(10_000);

    isActive = true;
    rerender(undefined);
    expect(result.current).toBe(15_000);
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(16_000);
  });

  it('pauses while the app is hidden and re-syncs when it returns', () => {
    const { result, rerender } = renderHook(() => useNowMs(1000));
    jest.mocked(useAppVisibility).mockReturnValue(false);
    rerender(undefined);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(10_000);

    jest.mocked(useAppVisibility).mockReturnValue(true);
    rerender(undefined);
    expect(result.current).toBe(13_000);
  });

  it('fails fast on a non-positive interval', () => {
    expect(() => renderHook(() => useNowMs(0))).toThrow(
      '[FAIL-FAST] useNowMs interval must be a positive integer: 0',
    );
  });
});
