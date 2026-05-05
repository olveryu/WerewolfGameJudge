/**
 * errorPipeline.test — Unit tests for the unified error handler
 */

import * as Sentry from '@sentry/react-native';

import { showAlert } from '@/utils/alert';

import { handleError } from '../errorPipeline';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

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

  it('logs warn and skips Sentry + UI for AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';

    handleError(err, baseOpts);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('aborted'), err);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
  });

  // ── Unexpected ──

  it('logs error + Sentry + showAlert for unexpected errors', () => {
    const err = new Error('network failure');

    handleError(err, baseOpts);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unexpected'), err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(showAlert).toHaveBeenCalledWith('测试操作失败', 'network failure');
  });

  // ── Expected by HTTP code ──

  it('skips Sentry for expectedCodes match', () => {
    const err = { status: 429, message: 'rate limited' } as unknown;

    handleError(err, { ...baseOpts, expectedCodes: [429] });

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('expected'), err);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith('测试操作失败', '请稍后重试');
  });

  // ── Expected by custom predicate ──

  it('skips Sentry when isExpected returns true', () => {
    const err = new Error('user cancelled');

    handleError(err, { ...baseOpts, isExpected: () => true });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalled();
  });

  // ── feedback: false suppresses UI ──

  it('suppresses UI when feedback is false', () => {
    const err = new Error('background fail');

    handleError(err, { ...baseOpts, feedback: false });

    expect(Sentry.captureException).toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
  });

  // ── Custom alertMessage ──

  it('uses custom alertMessage in alert', () => {
    const err = new Error('oops');

    handleError(err, {
      ...baseOpts,
      alertMessage: '自定义消息',
    });

    expect(showAlert).toHaveBeenCalledWith('测试操作失败', '自定义消息');
  });

  // ── PostgrestError-like code string ──

  it('extracts status from string code field (PostgrestError)', () => {
    const err = { code: '403', message: 'forbidden' } as unknown;

    handleError(err, { ...baseOpts, expectedCodes: [403] });

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
