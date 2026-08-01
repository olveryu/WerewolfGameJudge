/**
 * useHiddenDebugTrigger.test - Tests for hidden debug panel trigger hook
 *
 * Verifies tap counting, threshold detection, timeout reset, and admin
 * password gate behavior.
 */

import { act, renderHook } from '@testing-library/react-native';

import { useHiddenDebugTrigger } from '@/games/werewolf/room/hooks/useHiddenDebugTrigger';

// Mock logger
jest.mock('@/utils/logger', () => ({
  roomScreenLog: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockToggle = jest.fn<void, []>();
jest.mock('@/utils/debugLogStore', () => ({
  debugLogStore: {
    toggleVisibility: (): void => {
      mockToggle();
    },
  },
}));

// Mock credential store
const mockReadCredential = jest.fn<string | null, []>();
const mockWriteCredential = jest.fn<void, [string]>();
const mockClearCredential = jest.fn<void, []>();
jest.mock('@/features/admin/services/adminCredentialStore', () => ({
  readAdminCredential: () => mockReadCredential(),
  writeAdminCredential: (credential: string) => mockWriteCredential(credential),
  clearAdminCredential: () => mockClearCredential(),
}));

// Mock verifyAdminPassword
const mockVerify = jest.fn<Promise<boolean>, [string]>();
jest.mock('@/features/admin/services/adminApi', () => ({
  verifyAdminPassword: (pw: string) => mockVerify(pw),
}));

// Mock showPrompt
jest.mock('@/utils/alert', () => ({
  showPrompt: jest.fn(),
}));

describe('useHiddenDebugTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockReadCredential.mockReturnValue('test-password');
    mockVerify.mockResolvedValue(true);
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

  it('toggles debug panel on 5th tap when admin password is cached and valid', async () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());

    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    // Wait for async verify
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockVerify).toHaveBeenCalledWith('test-password');
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('clears cached password and does not toggle when verify fails', async () => {
    mockVerify.mockResolvedValue(false);
    const { result } = renderHook(() => useHiddenDebugTrigger());

    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockToggle).not.toHaveBeenCalled();
    expect(mockClearCredential).toHaveBeenCalled();
  });

  it('shows prompt when no cached password', () => {
    mockReadCredential.mockReturnValue(null);
    const alertMock: { showPrompt: jest.Mock } = jest.requireMock('@/utils/alert');
    const { showPrompt } = alertMock;

    const { result } = renderHook(() => useHiddenDebugTrigger());

    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    expect(showPrompt).toHaveBeenCalledWith('Admin 密码', expect.any(Object));
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('resets tap count after threshold is reached', async () => {
    const { result } = renderHook(() => useHiddenDebugTrigger());

    // First 5 taps → toggle
    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleDebugTitleTap());
    }

    await act(async () => {
      await Promise.resolve();
    });
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
