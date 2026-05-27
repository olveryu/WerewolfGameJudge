/**
 * Shared API Utilities — DRY extraction
 *
 * Provides common HTTP POST + error-handling infrastructure
 * shared by gameActions and seatActions. Contains no business logic.
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import { secureRng } from '@werewolf/game-engine/utils/random';

import { API_BASE_URL, API_REGION, API_TIMEOUT_MS } from '@/config/api';
import { fetchWithRetry } from '@/services/cloudflare/cfFetch';
import { createTimeoutSignal } from '@/utils/abortSignal';
import { facadeLog } from '@/utils/logger';

/** Standard API response (shared structure for game control and seat actions) */
export type ApiResponse =
  | { success: true; reason?: string; state?: Record<string, unknown>; revision?: number }
  | { success: false; reason: string };

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

    const result = (await res.json()) as ApiResponse;

    // Optimistic Response: apply immediately when HTTP response contains state, without waiting for broadcast
    if (result.success && result.state && result.revision != null && store) {
      store.applySnapshot(result.state as never, result.revision);
    }

    return result;
  } catch (e) {
    // Rethrow programming errors (ReferenceError = always a code bug).
    // TypeError is NOT rethrown because fetch() throws TypeError for network failures.
    if (e instanceof ReferenceError) {
      facadeLog.error('Programmer error in API call', { label, path, error: e });
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
        ((e as { name?: string }).name === 'AbortError' ||
          (e as { name?: string }).name === 'TimeoutError'));
    if (isAbortOrTimeout) {
      facadeLog.warn('timeout', { label, path, timeoutMs: API_TIMEOUT_MS, region: API_REGION });
      return { success: false, reason: 'TIMEOUT' };
    }

    const err = e as { message?: string };
    facadeLog.warn('network error', { label, path, error: err?.message ?? String(e) });
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
