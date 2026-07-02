/**
 * Test assertion helpers for HandlerResult discriminated union.
 *
 * Narrows the union to the expected variant so tests can access
 * `.actions`, `.reason`, `.sideEffects` without manual type guards.
 */

import type { HandlerError, HandlerRejection, HandlerResult, HandlerSuccess } from '../types';

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
