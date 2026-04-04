/**
 * ConnectionRecoveryManager — 通用断线恢复逻辑
 *
 * 从 GameFacade 提取，处理 L1 (WS reconnect → fetchStateFromDB) 恢复。
 * 当 WebSocket 重连成功（连续 Live 事件）后自动 fetch 最新 state。
 * 不涉及音频编排或 ack 重试（由 AudioOrchestrator 负责）。
 * Browser online 事件由上层 useConnectionSync 统一处理。
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
  /**
   * L1 重连检测：是否已经历过首次 Live 事件。
   * 区分「初始连接」与「重连」—— 首次 Live 不触发 fetchStateFromDB。
   * 每次 reset() 重置为 false。
   */
  #hasBeenLive = false;

  /** Unsubscribe the L1 status listener registered in constructor */
  #unsubscribeStatusListener: (() => void) | null = null;

  constructor(deps: ConnectionRecoveryDeps) {
    // L1: WS reconnect → fetchStateFromDB（所有玩家通用）
    this.#unsubscribeStatusListener = deps.addStatusListener((status) => {
      if (status !== ('Live' as ConnectionStatus)) return;
      if (!this.#hasBeenLive) {
        this.#hasBeenLive = true;
        return;
      }
      facadeLog.info('WS reconnected: fetching latest state from DB', { layer: 'L1' });
      void deps.fetchStateFromDB();
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /** Reset for new room (createRoom / joinRoom) */
  reset(): void {
    this.#hasBeenLive = false;
  }

  /** Cleanup all handlers (leaveRoom) */
  dispose(): void {
    this.#unsubscribeStatusListener?.();
    this.#unsubscribeStatusListener = null;
  }
}
