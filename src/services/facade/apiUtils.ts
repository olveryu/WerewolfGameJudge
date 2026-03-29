/**
 * Shared API Utilities — DRY 提取
 *
 * 提供通用 HTTP POST + 乐观更新 + 错误处理的基础设施，
 * 被 gameActions 和 seatActions 共用。不包含业务逻辑。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { secureRng } from '@werewolf/game-engine/utils/random';

import { API_BASE_URL, API_REGION, API_TIMEOUT_MS } from '@/config/api';
import { facadeLog } from '@/utils/logger';

/** 标准 API 响应（game control / seat 共用结构） */
export interface ApiResponse {
  success: boolean;
  reason?: string;
  state?: Record<string, unknown>;
  revision?: number;
}

/**
 * Apply optimistic update before fetch.
 * Call once before a request (or retry loop).
 */
function applyOptimisticUpdate(
  store: GameStore | undefined,
  optimisticFn: ((state: GameState) => GameState) | undefined,
): void {
  if (optimisticFn && store) {
    const currentState = store.getState();
    if (currentState) {
      store.applyOptimistic(optimisticFn(currentState));
    }
  }
}

/**
 * 执行单次 API POST 调用
 *
 * - 发送 JSON POST 请求
 * - 处理 non-JSON 错误页（502/503）
 * - 成功时 applySnapshot；失败时 rollbackOptimistic
 * - 网络错误自动 warn + rollback
 *
 * @param path - API 路径（如 '/game/assign'）
 * @param body - JSON body
 * @param label - 日志标签（如 'callGameControlApi'）
 * @param store - GameStore（用于 optimistic response apply）
 */
async function callApiOnce(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
): Promise<ApiResponse> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const requestId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `req_${Date.now()}_${Math.floor(secureRng() * 1_000_000)}`;
    const abortController = new AbortController();
    timeoutHandle = setTimeout(() => abortController.abort(), API_TIMEOUT_MS);

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-region': API_REGION,
        'x-request-id': requestId,
      },
      signal: abortController.signal,
      body: JSON.stringify(body),
    });
    clearTimeout(timeoutHandle);

    // Guard: non-JSON responses (502/503 error pages OR 200+text/html from proxy misconfiguration)
    if (!res.headers.get('content-type')?.includes('application/json')) {
      facadeLog.error(`${label} non-JSON response`, {
        path,
        status: res.status,
        requestId,
        region: API_REGION,
      });
      if (store) store.rollbackOptimistic();
      return { success: false, reason: 'SERVER_ERROR' };
    }

    const result = (await res.json()) as ApiResponse;

    // [DIAG] Log server response state fields for debugging
    if (result.state && typeof result.state === 'object') {
      const s = result.state as Record<string, unknown>;
      facadeLog.debug('[DIAG] API response state', {
        path,
        revision: result.revision,
        currentStepId: s.currentStepId,
        autoSkipDeadline: s.autoSkipDeadline,
        isAudioPlaying: s.isAudioPlaying,
        pendingAudioEffectsCount: Array.isArray(s.pendingAudioEffects)
          ? s.pendingAudioEffects.length
          : 0,
      });
    }

    // Optimistic Response: HTTP 响应含 state 时立即 apply，不等 broadcast
    if (result.success && result.state && result.revision != null && store) {
      store.applySnapshot(result.state as never, result.revision);
    }

    // 服务端拒绝 → 回滚乐观更新
    if (!result.success && store) {
      store.rollbackOptimistic();
    }

    return result;
  } catch (e) {
    // Rethrow programming errors (ReferenceError = always a code bug).
    // TypeError is NOT rethrown because fetch() throws TypeError for network failures.
    if (e instanceof ReferenceError) throw e;
    const abortLikeError =
      (typeof DOMException !== 'undefined' &&
        e instanceof DOMException &&
        e.name === 'AbortError') ||
      (typeof e === 'object' &&
        e !== null &&
        'name' in e &&
        (e as { name?: string }).name === 'AbortError');
    if (abortLikeError) {
      facadeLog.warn(`${label} timeout`, { path, timeoutMs: API_TIMEOUT_MS, region: API_REGION });
      if (store) store.rollbackOptimistic();
      return { success: false, reason: 'TIMEOUT' };
    }
    const err = e as { message?: string };
    facadeLog.warn(`${label} network error`, { path, error: err?.message ?? String(e) });
    // Network/fetch errors are expected (offline, DNS, timeout) — no Sentry
    // 网络错误 → 回滚乐观更新
    if (store) store.rollbackOptimistic();
    return { success: false, reason: 'NETWORK_ERROR' };
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

// =============================================================================
// Retry wrapper (DRY — shared by gameActions & seatActions)
// =============================================================================

/** 最大客户端重试次数 */
const MAX_CLIENT_RETRIES = 2;

/**
 * 带透明重试的 API 调用
 *
 * 封装 callApiOnce + 乐观更新 + 重试循环，供 gameActions / seatActions 共用。
 * 瞬时错误（CONFLICT_RETRY / INTERNAL_ERROR）透明重试最多 MAX_CLIENT_RETRIES 次，
 * 退避 + 随机抖动。NETWORK_ERROR / SERVER_ERROR 不重试（已在 callApiOnce 中 rollback）。
 */
export async function callApiWithRetry(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
  optimisticFn?: (state: GameState) => GameState,
): Promise<ApiResponse> {
  applyOptimisticUpdate(store, optimisticFn);

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    const result = await callApiOnce(path, body, label, store);

    // 网络/服务端错误已在 callApiOnce 中 rollback，不重试
    if (
      result.reason === 'NETWORK_ERROR' ||
      result.reason === 'SERVER_ERROR' ||
      result.reason === 'TIMEOUT'
    ) {
      return result;
    }

    // 瞬时错误 → 透明重试（退避 + 随机抖动）
    const isRetryable = result.reason === 'CONFLICT_RETRY' || result.reason === 'INTERNAL_ERROR';
    if (isRetryable && attempt < MAX_CLIENT_RETRIES) {
      const delay = 100 * (attempt + 1) + secureRng() * 50;
      facadeLog.warn(`${result.reason}, client retrying`, { path, attempt: attempt + 1 });
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return result;
  }

  // 重试耗尽 → 回滚乐观更新
  if (store) store.rollbackOptimistic();
  return { success: false, reason: 'CONFLICT_RETRY' };
}
