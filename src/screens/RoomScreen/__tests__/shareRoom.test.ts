/**
 * shareRoom.test - Tests for room link sharing utility
 *
 * Covers native Share API, mobile web navigator.share, desktop clipboard,
 * fallback paths, and cancellation handling.
 */

import { Platform, Share } from 'react-native';

// Save originals
const origNavigator = global.navigator;
const origWindow = global.window;

import { shareOrCopyRoomLink } from '../shareRoom';

describe('shareOrCopyRoomLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
  });

  // ── Native path ──

  it('should return "shared" when native Share resolves', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });

    const result = await shareOrCopyRoomLink('1234');
    expect(result).toBe('shared');
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://werewolf-judge.vercel.app/room/1234' }),
    );
  });

  it('should return "cancelled" when native Share is dismissed', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });

    expect(await shareOrCopyRoomLink('5678')).toBe('cancelled');
  });

  it('should return "failed" when native Share throws', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('share error'));

    expect(await shareOrCopyRoomLink('5678')).toBe('failed');
  });

  // ── Mobile web: navigator.share ──

  it('should use navigator.share on mobile web and return "shared"', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      value: { share: mockShare, maxTouchPoints: 1, clipboard: undefined },
      writable: true,
      configurable: true,
    });
    // Simulate touch device
    Object.defineProperty(global, 'window', {
      value: { ...origWindow, ontouchstart: true, location: { origin: 'https://test.local' } },
      writable: true,
      configurable: true,
    });

    const result = await shareOrCopyRoomLink('9999');
    expect(result).toBe('shared');
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://test.local/room/9999' }),
    );

    // Restore
    Object.defineProperty(global, 'navigator', {
      value: origNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });

  it('should return "cancelled" when mobile web share is dismissed', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const mockShare = jest.fn().mockRejectedValue(new DOMException('AbortError'));
    Object.defineProperty(global, 'navigator', {
      value: { share: mockShare, maxTouchPoints: 1, clipboard: undefined },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: { ...origWindow, ontouchstart: true, location: { origin: 'https://test.local' } },
      writable: true,
      configurable: true,
    });

    expect(await shareOrCopyRoomLink('1111')).toBe('cancelled');

    Object.defineProperty(global, 'navigator', {
      value: origNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });

  // ── Desktop web: clipboard ──

  it('should copy to clipboard on desktop web and return "copied"', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      value: { clipboard: { writeText: mockWriteText }, maxTouchPoints: 0 },
      writable: true,
      configurable: true,
    });
    // Desktop: no ontouchstart
    Object.defineProperty(global, 'window', {
      value: { location: { origin: 'https://desk.local' } },
      writable: true,
      configurable: true,
    });

    const result = await shareOrCopyRoomLink('2222');
    expect(result).toBe('copied');
    expect(mockWriteText).toHaveBeenCalledWith('https://desk.local/room/2222');

    Object.defineProperty(global, 'navigator', {
      value: origNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });

  // ── Last resort: desktop share fallback when clipboard fails ──

  it('should fall back to navigator.share on desktop when clipboard fails', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      value: {
        clipboard: { writeText: jest.fn().mockRejectedValue(new Error('blocked')) },
        share: mockShare,
        maxTouchPoints: 0,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: { location: { origin: 'https://desk.local' } },
      writable: true,
      configurable: true,
    });

    expect(await shareOrCopyRoomLink('3333')).toBe('shared');
    expect(mockShare).toHaveBeenCalled();

    Object.defineProperty(global, 'navigator', {
      value: origNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });

  // ── Complete failure ──

  it('should return "failed" when no sharing/clipboard method is available', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    Object.defineProperty(global, 'navigator', {
      value: { clipboard: undefined, maxTouchPoints: 0 },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: { location: { origin: 'https://test.local' } },
      writable: true,
      configurable: true,
    });

    expect(await shareOrCopyRoomLink('4444')).toBe('failed');

    Object.defineProperty(global, 'navigator', {
      value: origNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });
});
