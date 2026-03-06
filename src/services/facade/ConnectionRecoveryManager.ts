/**
 * ConnectionRecoveryManager — 通用断线恢复逻辑
 *
 * 从 GameFacade 提取，处理 L1 (SDK reconnect → fetchStateFromDB)
 * 和 L3 通用 (browser online → fetchStateFromDB) 两层恢复。
 * 不涉及音频编排或 ack 重试（由 AudioOrchestrator 负责）。
 */

import type { ConnectionStatus } from '@/services/types/IGameFacade';
import { facadeLog } from '@/utils/logger';

/** ConnectionRecoveryManager 的可注入依赖 */
export interface ConnectionRecoveryDeps {
  /** 订阅 Realtime 连接状态变化 */
  addStatusListener: (fn: (status: ConnectionStatus) => void) => () => void;
  /** 从 DB 拉取最新 state（Host + Player 通用） */
  fetchStateFromDB: () => Promise<boolean>;
}

export class ConnectionRecoveryManager {
  readonly #deps: ConnectionRecoveryDeps;

  /**
   * L1 重连检测：是否已经历过首次 Live 事件。
   * 区分「初始连接」与「重连」—— 首次 Live 不触发 fetchStateFromDB。
   * 每次 reset() 重置为 false。
   */
  #hasBeenLive = false;

  /** L3 通用：browser online 事件 → fetchStateFromDB（所有玩家，独立于 host-only ack 重试） */
  #onlineFetchHandler: (() => void) | null = null;

  /** Abort flag: set by facade when leaving room */
  #aborted = false;

  constructor(deps: ConnectionRecoveryDeps) {
    this.#deps = deps;

    // L1: SDK reconnect → fetchStateFromDB（所有玩家通用）
    deps.addStatusListener((status) => {
      if (status !== ('Live' as ConnectionStatus)) return;
      if (!this.#hasBeenLive) {
        this.#hasBeenLive = true;
        return;
      }
      facadeLog.info('SDK reconnected: fetching latest state from DB');
      void deps.fetchStateFromDB();
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /** Reset for new room (createRoom / joinRoom) */
  reset(): void {
    this.#hasBeenLive = false;
    this.#aborted = false;
    this.unregisterOnlineFetch();
  }

  /** Set abort flag (leaveRoom) */
  setAborted(aborted: boolean): void {
    this.#aborted = aborted;
  }

  /** Cleanup all handlers (leaveRoom) */
  dispose(): void {
    this.unregisterOnlineFetch();
  }

  // =========================================================================
  // L3 Universal: browser online → fetchStateFromDB
  // =========================================================================

  /**
   * 注册 browser online 事件监听 → fetchStateFromDB。
   *
   * 对所有玩家生效（host + non-host）。覆盖 Web 平台 setOffline(false) 恢复后
   * SDK 未触发 Live 事件的边缘场景。与 L1 status listener fetch 互补 —
   * 两者可能同时触发，fetchStateFromDB 幂等无害。
   *
   * 在 createRoom / joinRoom 后调用，leaveRoom 时注销。
   */
  registerOnlineFetch(): void {
    this.unregisterOnlineFetch();
    if (typeof globalThis.window?.addEventListener !== 'function') return;

    this.#onlineFetchHandler = () => {
      if (this.#aborted) return;
      facadeLog.info('Browser online event: fetching latest state from DB');
      void this.#deps.fetchStateFromDB();
    };
    globalThis.window.addEventListener('online', this.#onlineFetchHandler);
  }

  unregisterOnlineFetch(): void {
    if (this.#onlineFetchHandler !== null) {
      if (typeof globalThis.window?.removeEventListener === 'function') {
        globalThis.window.removeEventListener('online', this.#onlineFetchHandler);
      }
      this.#onlineFetchHandler = null;
    }
  }
}
