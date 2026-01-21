/**
 * GameStore - 状态持有者
 *
 * 职责：
 * - 持有 GameState（= BroadcastGameState）
 * - 管理 revision 版本号
 * - 订阅/通知机制
 * - 玩家端：applySnapshot（版本号检查）
 * - 主机端：setState / updateState
 */

import type { GameState, StateListener, IHostGameStore } from './types';
import { normalizeState } from '../../core/state/normalize';

export class GameStore implements IHostGameStore {
  private state: GameState | null = null;
  private revision: number = 0;
  private readonly listeners: Set<StateListener> = new Set();

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
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 应用快照（玩家端）
   * 仅当 incoming revision > local revision 时应用
   */
  applySnapshot(state: GameState, revision: number): void {
    if (revision <= this.revision) {
      // 丢弃旧版本
      return;
    }

    this.state = state;
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
   * 重置 store
   */
  reset(): void {
    this.state = null;
    this.revision = 0;
    this.listeners.clear();
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
        console.error('[GameStore] Listener error:', error);
      }
    }
  }
}
