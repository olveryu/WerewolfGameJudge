/**
 * Tests for timeout utilities
 *
 * Contract coverage:
 * 1) original promise resolves => correct return value, timer cleaned up
 * 2) original promise rejects => propagates rejection, timer cleaned up
 * 3) timeout => rejects with error from errorFactory (if provided)
 * 4) no unhandled rejection with fake timers
 */

import { withTimeout } from '@/utils/withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should resolve when promise completes before timeout', async () => {
    const fastPromise = Promise.resolve('success');

    const result = await withTimeout(fastPromise, 1000, 'test');

    expect(result).toBe('success');
  });

  it('should reject when promise takes longer than timeout (default error)', async () => {
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 2000);
    });

    const resultPromise = withTimeout(slowPromise, 1000, 'slowOp');

    // Bind expect before advancing timers to avoid unhandled rejection
    const expectation = expect(resultPromise).rejects.toThrow(/timed out/);

    // Fast-forward past the timeout
    jest.advanceTimersByTime(1001);

    await expectation;
  });

  it('should use custom errorFactory when provided', async () => {
    const slowPromise = new Promise<string>(() => {
      // Never resolves
    });

    const customError = () => new Error('自定义超时错误');
    const resultPromise = withTimeout(slowPromise, 500, customError);

    // Bind expect before advancing timers
    const expectation = expect(resultPromise).rejects.toThrow('自定义超时错误');

    jest.advanceTimersByTime(501);

    await expectation;
  });

  it('should clean up timer when promise resolves', async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');

    const fastPromise = Promise.resolve('done');
    await withTimeout(fastPromise, 5000);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should clean up timer when promise rejects', async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');

    const failingPromise = Promise.reject(new Error('original error'));
    await expect(withTimeout(failingPromise, 5000)).rejects.toThrow('original error');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should clean up timer when timeout fires', async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');

    const slowPromise = new Promise<void>(() => {});
    const resultPromise = withTimeout(slowPromise, 100);

    // Bind catch before advancing timers
    const catchPromise = resultPromise.catch(() => {
      /* expected rejection */
    });

    jest.advanceTimersByTime(101);
    await catchPromise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should pass original rejection through unchanged', async () => {
    const originalError = new Error('original network error');
    const failingPromise = Promise.reject(originalError);

    await expect(withTimeout(failingPromise, 5000)).rejects.toBe(originalError);
  });
});
