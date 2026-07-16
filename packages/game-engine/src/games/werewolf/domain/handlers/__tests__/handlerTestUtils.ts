/**
 * Test assertion helpers for HandlerResult discriminated union.
 *
 * Narrows the union to the expected variant so tests can access
 * `.actions` and `.reason` without manual type guards.
 */

import type {
  HandlerError,
  HandlerExecutionContext,
  HandlerRejection,
  HandlerResult,
  HandlerSuccess,
} from '../types';

export const TEST_HANDLER_EXECUTION: HandlerExecutionContext = Object.freeze({
  nowMs: 1_000_000,
  commandId: 'test-command',
  randomSeed: 'test-random-seed',
});

/** Assert result is a success and narrow the type. */
export function expectSuccess(result: HandlerResult): HandlerSuccess {
  expect(result.kind).toBe('success');
  return result as HandlerSuccess;
}

/** Assert result is an error and narrow the type. */
export function expectError(result: HandlerResult): HandlerError {
  expect(result.kind).toBe('error');
  return result as HandlerError;
}

/** Assert result is a rejection and narrow the type. */
export function expectRejection(result: HandlerResult): HandlerRejection {
  expect(result.kind).toBe('rejection');
  return result as HandlerRejection;
}
