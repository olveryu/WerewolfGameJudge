/**
 * useHiddenDebugTrigger.test - Tests for hidden debug panel trigger hook
 *
 * Verifies tap counting, threshold detection, and timeout reset behavior.
 */

import { act, renderHook } from '@testing-library/react-native';

import { useHiddenDebugTrigger } from '@/screens/RoomScreen/hooks/useHiddenDebugTrigger';

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  roomScreenLog: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock mobileDebug
const mockToggle = jest.fn();
jest.mock('../../../../utils/mobileDebug', () => ({
  mobileDebug: {
    toggle: () => mockToggle(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    clear: jest.fn(),
    isVisible: jest.fn(),
  },
}));

describe('useHiddenDebugTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns handleDebugTitleTap function', () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());
    expect(typeof result.current.handleDebugTitleTap).toBe('function');
  });

  it('does NOT toggle debug panel before reaching threshold (5 taps)', () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());

    for (let i = 0; i < 4; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('toggles debug panel on 5th tap', () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());

    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('resets tap count after threshold is reached', () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());

    // First 5 taps → toggle
    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleDebugTitleTap());
    }
    expect(mockToggle).toHaveBeenCalledTimes(1);

    // Next 4 taps → should NOT toggle again
    for (let i = 0; i < 4; i++) {
      act(() => result.current.handleDebugTitleTap());
    }
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('resets tap count after timeout (2s)', () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());

    // Tap 3 times
    for (let i = 0; i < 3; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    // Advance past timeout
    act(() => jest.advanceTimersByTime(2100));

    // Tap 4 more (total after reset = 4, should NOT toggle)
    for (let i = 0; i < 4; i++) {
      act(() => result.current.handleDebugTitleTap());
    }
    expect(mockToggle).not.toHaveBeenCalled();
  });
});
