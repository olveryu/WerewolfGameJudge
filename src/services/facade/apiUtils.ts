/**
 * Shared API Utilities — DRY 提取
 *
 * 提供通用 HTTP POST + 错误处理的基础设施，
 * 被 gameActions 和 seatActions 共用。不包含业务逻辑。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import { secureRng } from '@werewolf/game-engine/utils/random';

import { API_BASE_URL, API_REGION, API_TIMEOUT_MS } from '@/config/api';
import { fetchWithRetry } from '@/services/cloudflare/cfFetch';
import { facadeLog } from '@/utils/logger';

/** 标准 API 响应（game control / seat 共用结构） */
export interface ApiResponse {
  success: boolean;
  reason?: string;
  state?: Record<string, unknown>;
  revision?: number;
}

/**
 * 执行单次 API POST 调用
 *
 * - fetchWithRetry 网络层自动重试 + AbortSignal.timeout 超时
 * - 处理 non-JSON 错误页（502/503）
 * - 成功时 applySnapshot
 * - 网络错误自动 warn
 *
 * @param path - API 路径（如 '/game/assign'）
 * @param body - JSON body
 * @param label - 日志标签（如 'callGameControlApi'）
 * @param store - GameStore（用于 response apply）
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
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
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

    // Optimistic Response: HTTP 响应含 state 时立即 apply，不等 broadcast
    if (result.success && result.state && result.revision != null && store) {
      store.applySnapshot(result.state as never, result.revision);
    }

    return result;
  } catch (e) {
    // Rethrow programming errors (ReferenceError = always a code bug).
    // TypeError is NOT rethrown because fetch() throws TypeError for network failures.
    if (e instanceof ReferenceError) throw e;

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

/** 最大客户端重试次数 */
const MAX_CLIENT_RETRIES = 2;

/** 总预算：防止 cfFetch 重试 × callApiWithRetry 重试叠加导致等待过长 */
const CALL_API_TOTAL_BUDGET_MS = 30_000;

/**
 * 带透明重试的 API 调用
 *
 * 封装 callApiOnce + 重试循环，供 gameActions / seatActions 共用。
 * 重试 CONFLICT_RETRY / INTERNAL_ERROR / NETWORK_ERROR / SERVER_ERROR，
 * 不重试 TIMEOUT（请求可能已到达服务端，重发不安全）。
 * 30s 总预算截断防止叠加等待过长。
 */
export async function callApiWithRetry(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
): Promise<ApiResponse> {
  const startTime = Date.now();

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    // 总预算检查（首次不检查）
    if (attempt > 0 && Date.now() - startTime > CALL_API_TOTAL_BUDGET_MS) {
      facadeLog.warn('total budget exceeded', { path, elapsed: Date.now() - startTime });
      break;
    }

    const result = await callApiOnce(path, body, label, store);

    if (result.success) return result;

    // TIMEOUT 不重试：请求可能已到达服务端，重发不安全
    if (result.reason === 'TIMEOUT') return result;

    // 可重试的 reason
    const isRetryable =
      result.reason === 'CONFLICT_RETRY' ||
      result.reason === 'INTERNAL_ERROR' ||
      result.reason === 'NETWORK_ERROR' ||
      result.reason === 'SERVER_ERROR';

    if (isRetryable && attempt < MAX_CLIENT_RETRIES) {
      // cfFetch 层已处理慢网络（1s+2s 退避），业务层退避保持短（面对面游戏不能等太久）
      const delay = 300 * (attempt + 1) + secureRng() * 100;
      facadeLog.warn('client retrying', { reason: result.reason, path, attempt: attempt + 1 });
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return result;
  }

  // 重试耗尽或预算超限
  return { success: false, reason: 'NETWORK_ERROR' };
}
