/**
 * GameStore - 游戏状态持有者
 *
 * 职责：
 * - 持有 GameState（= BroadcastGameState）
 * - 管理 revision 版本号
 * - 订阅/通知机制
 * - 玩家端：applySnapshot（版本号检查）
 * - 主机端：setState / updateState
 *
 * ✅ 允许：state CRUD + revision 管理 + listener 通知
 * ❌ 禁止：业务逻辑（校验/结算/流程推进）
 * ❌ 禁止：IO（网络/音频/Alert）
 */

import { normalizeState } from '@/services/engine/state/normalize';
import { log } from '@/utils/logger';

import type { GameState, IHostGameStore,StoreStateListener } from './types';

const gameStoreLog = log.extend('GameStore');

export class GameStore implements IHostGameStore {
  private state: GameState | null = null;
  private revision: number = 0;
  private readonly listeners: Set<StoreStateListener> = new Set();

  /**
   * Host-only: apply an existing snapshot as the current state, preserving the given revision.
   *
   * Rationale: Host rejoin needs to restore its last authoritative BroadcastGameState + revision
   * so that connected Players (who may already be at a higher revision) will accept subsequent
   * STATE_UPDATE broadcasts.
   */
  applyHostSnapshot(state: GameState, revision: number): void {
    this.state = normalizeState(state);
    this.revision = revision;
    this.notifyListeners();
  }

  /**
   * 获取当前状态
   */
  getState(): GameState | null {
    return this.state;
  }

  /**
   * 获取当前 revision
   */
  getRevision(): number {
    return this.revision;
  }

  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  subscribe(listener: StoreStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 应用快照（玩家端）
   * 仅当 incoming revision > local revision 时应用
   * 应用 normalizeState 确保 Host/Player shape 一致（anti-drift）
   */
  applySnapshot(state: GameState, revision: number): void {
    if (revision <= this.revision) {
      // 丢弃旧版本
      return;
    }

    this.state = normalizeState(state);
    this.revision = revision;
    this.notifyListeners();
  }

  /**
   * 设置状态（仅主机）
   * 自动递增 revision 并归一化
   */
  setState(state: GameState): void {
    this.state = normalizeState(state);
    this.revision += 1;
    this.notifyListeners();
  }

  /**
   * 增量更新状态（仅主机）
   * @param updater 状态更新函数
   */
  updateState(updater: (state: GameState) => GameState): void {
    if (!this.state) {
      throw new Error('Cannot update state: no state initialized');
    }

    const newState = updater(this.state);
    this.setState(newState);
  }

  /**
   * 初始化状态（主机创建房间时）
   */
  initialize(state: GameState): void {
    this.state = normalizeState(state);
    this.revision = 1;
    this.notifyListeners();
  }

  /**
   * 重置 store（只清除 state，保留 listeners）
   * 用于 leaveRoom 等场景
   */
  reset(): void {
    this.state = null;
    this.revision = 0;
    // 注意：不清除 listeners，因为 React useEffect 的 listener 生命周期独立于 store
    // 通知 listeners state 已变为 null
    for (const listener of this.listeners) {
      try {
        listener(null, 0);
      } catch (error) {
        gameStoreLog.error('Listener error in reset', { error });
      }
    }
  }

  /**
   * 完全销毁 store（包括 listeners）
   * 仅用于测试隔离
   */
  destroy(): void {
    this.state = null;
    this.revision = 0;
    this.listeners.clear();
  }

  /**
   * 获取当前 listener 数量（仅用于测试/调试）
   */
  getListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * 通知所有订阅者
   */
  private notifyListeners(): void {
    if (!this.state) return;

    for (const listener of this.listeners) {
      try {
        listener(this.state, this.revision);
      } catch (error) {
        // 防止单个 listener 错误影响其他订阅者
        gameStoreLog.error('Listener error', { error });
      }
    }
  }
}
