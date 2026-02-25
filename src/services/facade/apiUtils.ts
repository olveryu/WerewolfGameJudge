/**
 * Shared API Utilities — DRY 提取
 *
 * 提供通用 HTTP POST + 乐观更新 + 错误处理的基础设施，
 * 被 hostActions 和 seatActions 共用。不包含业务逻辑。
 */

import * as Sentry from '@sentry/react-native';
import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/engine/store/types';

import { API_BASE_URL } from '@/config/api';
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
export function applyOptimisticUpdate(
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
 * - 网络错误自动 Sentry 上报 + rollback
 *
 * @param path - API 路径（如 '/api/game/assign'）
 * @param body - JSON body
 * @param label - 日志标签（如 'callGameControlApi'）
 * @param store - GameStore（用于 optimistic response apply）
 */
export async function callApiOnce(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Guard: non-JSON error pages (502/503) would throw SyntaxError in .json()
    if (!res.ok && !res.headers.get('content-type')?.includes('application/json')) {
      facadeLog.error(`${label} non-JSON error`, { path, status: res.status });
      if (store) store.rollbackOptimistic();
      return { success: false, reason: 'SERVER_ERROR' };
    }

    const result = (await res.json()) as ApiResponse;

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
    const err = e as { message?: string };
    facadeLog.error(`${label} failed`, { path, error: err?.message ?? String(e) });
    Sentry.captureException(e);
    // 网络错误 → 回滚乐观更新
    if (store) store.rollbackOptimistic();
    return { success: false, reason: 'NETWORK_ERROR' };
  }
}
