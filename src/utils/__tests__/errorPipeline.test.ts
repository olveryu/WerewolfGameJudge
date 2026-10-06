/**
 * errorPipeline.test — Unit tests for the unified error classifier
 *
 * handleError is UI-free: it classifies, logs, reports to Sentry, and returns
 * a HandleErrorResult. Callers own all UI decisions.
 */

import * as Sentry from '@sentry/react-native';

import { handleError } from '../errorPipeline';
import { NetworkTimeoutError } from '../errorUtils';

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleError', () => {
  const baseOpts = { label: '测试操作', logger: mockLogger };

  // ── Abort ──

  it('logs warn, skips Sentry, and marks aborted for AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';

    const result = handleError(err, baseOpts);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('aborted'), err);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result).toEqual({ message: '', isExpected: true, aborted: true });
  });

  it('marks aborted for wrapped AbortError', () => {
    const err = new Error('request wrapper', {
      cause: new DOMException('aborted', 'AbortError'),
    });

    const result = handleError(err, baseOpts);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('aborted'), err);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.aborted).toBe(true);
  });

  it('classifies a wrapped fetch failure as a network error', () => {
    const err = new Error('Failed to produce JSON response for /room/get during body-read', {
      cause: new TypeError('Failed to fetch'),
    });

    const result = handleError(err, baseOpts);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('network error'), err);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: '网络异常，请检查网络后重试',
      isExpected: true,
      aborted: false,
    });
  });

  it('classifies a typed network timeout without reporting it to Sentry', () => {
    const err = new NetworkTimeoutError('connectAndWait', 15_000);

    const result = handleError(err, baseOpts);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('network error'), err);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.message).toBe('网络异常，请检查网络后重试');
    expect(result.isExpected).toBe(true);
    expect(result.aborted).toBe(false);
  });

  // ── Unexpected ──

  it('logs error + Sentry for unexpected errors', () => {
    const err = new Error('network failure');

    const result = handleError(err, baseOpts);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unexpected'), err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(result).toEqual({ message: 'network failure', isExpected: false, aborted: false });
  });

  // ── Expected by HTTP code ──

  it('skips Sentry for expectedCodes match', () => {
    const err = { status: 429, message: 'rate limited' } as unknown;

    const result = handleError(err, { ...baseOpts, expectedCodes: [429] });

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('expected'), err);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.message).toBe('请稍后重试');
    expect(result.isExpected).toBe(true);
    expect(result.aborted).toBe(false);
  });

  // ── Expected by custom predicate ──

  it('skips Sentry when isExpected returns true', () => {
    const err = new Error('user cancelled');

    const result = handleError(err, { ...baseOpts, isExpected: () => true });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.isExpected).toBe(true);
    expect(result.aborted).toBe(false);
  });

  // ── Custom alertMessage ──

  it('uses custom alertMessage in result', () => {
    const err = new Error('oops');

    const result = handleError(err, {
      ...baseOpts,
      alertMessage: '自定义消息',
    });

    expect(result.message).toBe('自定义消息');
  });

  // ── PostgrestError-like code string ──

  it('extracts status from string code field (PostgrestError)', () => {
    const err = { code: '403', message: 'forbidden' } as unknown;

    const result = handleError(err, { ...baseOpts, expectedCodes: [403] });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.isExpected).toBe(true);
  });
});
