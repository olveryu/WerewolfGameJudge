/**
 * GameStore - 游戏状态持有者
 *
 * 职责：
 * - 持有 normalized GameState
 * - 管理 revision 版本号
 * - 订阅/通知机制
 * - 玩家端：applySnapshot（版本号检查）
 * - 主机端：setState / updateState
 *
 * Store 是 parse boundary：input 接收 GameState，
 * 内部 normalizeState() 后存储为 GameState（tight）。
 * 不包含业务逻辑（校验/结算/流程推进），不包含 IO（网络/音频/Alert）。
 */

import { getEngineLogger } from '../../utils/logger';
import { normalizeState } from '../state/normalize';
import type { GameState, IWritableGameStore, StoreStateListener } from './types';

const gameStoreLog = getEngineLogger().extend('GameStore');

export class GameStore implements IWritableGameStore {
  #state: GameState | null = null;
  #revision: number = 0;
  readonly #listeners: Set<StoreStateListener> = new Set();

  /** 最近一次广播携带的 action 类型（一次性消费） */
  #lastAction: string | null = null;

  /**
   * 获取当前状态
   */
  getState(): GameState | null {
    return this.#state;
  }

  /**
   * 获取当前 revision
   */
  getRevision(): number {
    return this.#revision;
  }

  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  subscribe(listener: StoreStateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * 应用快照（玩家端）
   * 仅当 incoming revision > local revision 时应用
   * 应用 normalizeState 确保 Host/Player shape 一致（anti-drift）
   */
  applySnapshot(state: GameState, revision: number, lastAction?: string): void {
    if (revision <= this.#revision) {
      // 丢弃旧版本
      return;
    }

    this.#state = normalizeState(state);
    this.#revision = revision;
    this.#lastAction = lastAction ?? null;

    this.#notifyListeners();
  }

  /**
   * 设置状态（仅主机）
   * 自动递增 revision 并归一化
   */
  setState(state: GameState): void {
    this.#state = normalizeState(state);
    this.#revision += 1;
    this.#notifyListeners();
  }

  /**
   * 增量更新状态（仅主机）
   * @param updater 状态更新函数
   */
  updateState(updater: (state: GameState) => GameState): void {
    if (!this.#state) {
      throw new Error('Cannot update state: no state initialized');
    }

    const newState = updater(this.#state);
    this.setState(newState);
  }

  /**
   * 初始化状态（主机创建房间时）
   */
  initialize(state: GameState): void {
    this.#state = normalizeState(state);
    this.#revision = 1;
    this.#notifyListeners();
  }

  /**
   * 重置 store（只清除 state，保留 listeners）
   * 用于 leaveRoom 等场景
   */
  reset(): void {
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    // 注意：不清除 listeners，因为 React useEffect 的 listener 生命周期独立于 store
    // 通知 listeners state 已变为 null
    for (const listener of this.#listeners) {
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
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    this.#listeners.clear();
  }

  /**
   * 消费最近一次广播携带的 lastAction（一次性读取，读后清除）
   */
  consumeLastAction(): string | null {
    const action = this.#lastAction;
    this.#lastAction = null;
    return action;
  }

  /**
   * 获取当前 listener 数量（仅用于测试/调试）
   */
  getListenerCount(): number {
    return this.#listeners.size;
  }

  /**
   * 通知所有订阅者
   */
  #notifyListeners(): void {
    if (!this.#state) return;

    for (const listener of this.#listeners) {
      try {
        listener(this.#state, this.#revision);
      } catch (error) {
        // 防止单个 listener 错误影响其他订阅者
        gameStoreLog.error('Listener error', { error });
      }
    }
  }
}
