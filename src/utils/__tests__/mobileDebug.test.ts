/**
 * @jest-environment jsdom
 */

/**
 * Tests for mobileDebug utility
 *
 * mobileDebug is mostly a Web-only DOM utility. We test:
 * - Platform guard (no-op on non-web)
 * - Transport function
 * - State management (clear, visibility)
 */

import { Platform } from 'react-native';

import { mobileDebug, mobileDebugTransport } from '@/utils/mobileDebug';

// Mock Platform.OS - default to 'web' for most tests
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock DOM APIs for web environment
beforeEach(() => {
  // Reset module-level state by clearing visibility
  mobileDebug.clear();
  mobileDebug.hide();
});

describe('mobileDebug (web)', () => {
  it('log does not throw on web', () => {
    expect(() => mobileDebug.log('test message')).not.toThrow();
  });

  it('warn does not throw on web', () => {
    expect(() => mobileDebug.warn('warning')).not.toThrow();
  });

  it('error does not throw on web', () => {
    expect(() => mobileDebug.error('error')).not.toThrow();
  });

  it('debug does not throw on web', () => {
    // eslint-disable-next-line testing-library/no-debugging-utils -- not a testing-library debug()
    expect(() => mobileDebug.debug('debug message')).not.toThrow();
  });

  it('clear does not throw', () => {
    mobileDebug.log('something');
    expect(() => mobileDebug.clear()).not.toThrow();
  });

  it('toggle flips visibility state', () => {
    expect(mobileDebug.isVisible()).toBe(false);
    // Note: show() requires DOM (document.createElement) which is available in jsdom
    mobileDebug.show();
    expect(mobileDebug.isVisible()).toBe(true);
    mobileDebug.hide();
    expect(mobileDebug.isVisible()).toBe(false);
  });

  it('toggle calls show then hide', () => {
    mobileDebug.toggle(); // show
    expect(mobileDebug.isVisible()).toBe(true);
    mobileDebug.toggle(); // hide
    expect(mobileDebug.isVisible()).toBe(false);
  });
});

describe('mobileDebugTransport', () => {
  it('does not throw when called on web', () => {
    expect(() =>
      mobileDebugTransport({
        msg: 'test',
        rawMsg: 'test',
        level: { severity: 1, text: 'info' },
        extension: 'Test',
      }),
    ).not.toThrow();
  });

  it('handles all log levels', () => {
    const levels = ['debug', 'info', 'warn', 'error'];
    for (const text of levels) {
      expect(() =>
        mobileDebugTransport({
          msg: `${text} message`,
          rawMsg: `${text} message`,
          level: { severity: 0, text },
          extension: null,
        }),
      ).not.toThrow();
    }
  });

  it('handles unknown log level gracefully', () => {
    expect(() =>
      mobileDebugTransport({
        msg: 'test',
        rawMsg: 'test',
        level: { severity: 0, text: 'unknown' },
        extension: null,
      }),
    ).not.toThrow();
  });

  it('handles null extension', () => {
    expect(() =>
      mobileDebugTransport({
        msg: 'test',
        rawMsg: 'test',
        level: { severity: 1, text: 'info' },
        extension: null,
      }),
    ).not.toThrow();
  });
});

describe('mobileDebug (non-web platform)', () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'ios';
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = 'web';
  });

  it('log is no-op on iOS', () => {
    expect(() => mobileDebug.log('test')).not.toThrow();
  });

  it('show is no-op on iOS', () => {
    mobileDebug.show();
    expect(mobileDebug.isVisible()).toBe(false);
  });

  it('transport is no-op on iOS', () => {
    expect(() =>
      mobileDebugTransport({
        msg: 'test',
        rawMsg: 'test',
        level: { severity: 1, text: 'info' },
        extension: null,
      }),
    ).not.toThrow();
  });
});
