/**
 * Shared API Utilities — DRY extraction
 *
 * Provides common HTTP POST + error-handling infrastructure
 * shared by gameActions and seatActions. Contains no business logic.
 */

import { parseWerewolfState } from '@werewolf/game-engine';
import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { secureRng } from '@werewolf/game-engine/utils/random';

import { API_BASE_URL, API_REGION, API_TIMEOUT_MS } from '@/config/api';
import { fetchWithRetry } from '@/services/cloudflare/cfFetch';
import { createTimeoutSignal } from '@/utils/abortSignal';
import { handleError } from '@/utils/errorPipeline';
import { facadeLog } from '@/utils/logger';

/** Standard API response (shared structure for game control and seat actions) */
export type ApiResponse =
  | { success: true; reason?: string; state?: GameState; revision?: number }
  | { success: false; reason: string };

class ApiProtocolError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ApiProtocolError';
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ApiProtocolError(`${fieldName} must be a string`);
  }
  return value;
}

function parseApiResponse(value: unknown): ApiResponse {
  if (!isRecord(value)) {
    throw new ApiProtocolError('Game API response must be an object');
  }
  const allowedKeys = new Set(['success', 'reason', 'state', 'revision']);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new ApiProtocolError(`Game API response contains unknown field: ${key}`);
    }
  }

  if (value.success === false) {
    if (typeof value.reason !== 'string' || value.reason.length === 0) {
      throw new ApiProtocolError('Failed game API response must contain a reason');
    }
    if (value.state !== undefined || value.revision !== undefined) {
      throw new ApiProtocolError('Failed game API response cannot contain state');
    }
    return { success: false, reason: value.reason };
  }
  if (value.success !== true) {
    throw new ApiProtocolError('Game API response success must be a boolean');
  }

  const reason = parseOptionalString(value.reason, 'Game API response reason');
  const hasState = value.state !== undefined;
  const hasRevision = value.revision !== undefined;
  if (hasState !== hasRevision) {
    throw new ApiProtocolError('Successful game API response must pair state with revision');
  }
  if (!hasState) {
    return reason === undefined ? { success: true } : { success: true, reason };
  }
  if (
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1
  ) {
    throw new ApiProtocolError('Game API response revision must be a positive safe integer');
  }

  try {
    const state = parseWerewolfState(value.state);
    return reason === undefined
      ? { success: true, state, revision: value.revision }
      : { success: true, reason, state, revision: value.revision };
  } catch (error) {
    throw new ApiProtocolError('Game API response contains invalid Werewolf state', error);
  }
}

/**
 * Executes a single API POST call
 *
 * - fetchWithRetry handles network-layer auto-retry + createTimeoutSignal timeout
 * - Handles non-JSON error pages (502/503)
 * - Calls applySnapshot on success
 * - Network errors are logged as warn automatically
 *
 * @param path - API path (e.g. '/game/assign')
 * @param body - JSON body
 * @param label - log label (e.g. 'callGameControlApi')
 * @param store - GameStore (used for response apply)
 */
async function callApiOnce(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
): Promise<ApiResponse> {
  try {
    const requestId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `req_${Date.now()}_${Math.floor(secureRng() * 1_000_000)}`;

    const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-region': API_REGION,
        'x-request-id': requestId,
      },
      signal: createTimeoutSignal(API_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    // Guard: non-JSON responses (502/503 error pages OR 200+text/html from proxy misconfiguration)
    if (!res.headers.get('content-type')?.includes('application/json')) {
      facadeLog.error('non-JSON response', {
        label,
        path,
        status: res.status,
        requestId,
        region: API_REGION,
      });
      return { success: false, reason: 'SERVER_ERROR' };
    }

    const payload: unknown = await res.json();
    const result = parseApiResponse(payload);

    // Optimistic Response: apply immediately when HTTP response contains state, without waiting for broadcast
    if (result.success && result.state && result.revision != null && store) {
      store.applySnapshot(result.state, result.revision);
    }

    return result;
  } catch (e) {
    // Rethrow programming errors (ReferenceError = always a code bug).
    // TypeError is NOT rethrown because fetch() throws TypeError for network failures.
    if (e instanceof ReferenceError || e instanceof ApiProtocolError) {
      handleError(e, { label, logger: facadeLog, feedback: false });
      throw e;
    }

    // AbortSignal.timeout() throws DOMException { name: 'TimeoutError' }
    // User cancel throws DOMException { name: 'AbortError' }
    // Also handle plain Error with abort name (polyfill / test environments)
    const isAbortOrTimeout =
      (typeof DOMException !== 'undefined' &&
        e instanceof DOMException &&
        (e.name === 'AbortError' || e.name === 'TimeoutError')) ||
      (typeof e === 'object' &&
        e !== null &&
        'name' in e &&
        (e.name === 'AbortError' || e.name === 'TimeoutError'));
    if (isAbortOrTimeout) {
      facadeLog.warn('timeout', { label, path, timeoutMs: API_TIMEOUT_MS, region: API_REGION });
      return { success: false, reason: 'TIMEOUT' };
    }

    facadeLog.warn('network error', {
      label,
      path,
      error: e instanceof Error ? e.message : String(e),
    });
    // Network/fetch errors are expected (offline, DNS, timeout) — no Sentry
    return { success: false, reason: 'NETWORK_ERROR' };
  }
}

// =============================================================================
// Retry wrapper (DRY — shared by gameActions & seatActions)
// =============================================================================

/** Maximum client retry count */
const MAX_CLIENT_RETRIES = 2;

/** Total budget: prevents excessively long waits from cfFetch retries × callApiWithRetry retries stacking up */
const CALL_API_TOTAL_BUDGET_MS = 30_000;

/**
 * API call with transparent retry
 *
 * Wraps callApiOnce with a retry loop; shared by gameActions and seatActions.
 * Retries on CONFLICT_RETRY / INTERNAL_ERROR / NETWORK_ERROR / SERVER_ERROR;
 * does not retry TIMEOUT (the request may have already reached the server; resending is unsafe).
 * 30s total budget cap prevents compounding wait time.
 */
export async function callApiWithRetry(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
): Promise<ApiResponse> {
  const startTime = Date.now();

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    // Total budget check (skipped on first attempt)
    if (attempt > 0 && Date.now() - startTime > CALL_API_TOTAL_BUDGET_MS) {
      facadeLog.warn('total budget exceeded', { path, elapsed: Date.now() - startTime });
      break;
    }

    const result = await callApiOnce(path, body, label, store);

    if (result.success) return result;

    // Do not retry TIMEOUT: request may have already reached the server; resending is unsafe
    if (result.reason === 'TIMEOUT') return result;

    // Retryable reason
    const isRetryable =
      result.reason === 'CONFLICT_RETRY' ||
      result.reason === 'INTERNAL_ERROR' ||
      result.reason === 'NETWORK_ERROR' ||
      result.reason === 'SERVER_ERROR';

    if (isRetryable && attempt < MAX_CLIENT_RETRIES) {
      // cfFetch layer already handles slow networks (1s+2s backoff); keep business-layer backoff short (face-to-face game can't wait too long)
      const delay = 300 * (attempt + 1) + secureRng() * 100;
      facadeLog.warn('client retrying', { reason: result.reason, path, attempt: attempt + 1 });
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return result;
  }

  // Retries exhausted or budget exceeded
  return { success: false, reason: 'NETWORK_ERROR' };
}
