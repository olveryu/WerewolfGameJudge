/**
 * Store Types - 状态存储类型定义
 *
 * GameState ≡ BroadcastGameState（单一状态形态）
 */

import type { BroadcastGameState } from '@/services/protocol/types';

/**
 * 游戏状态类型别名
 * 主机和玩家持有完全相同的类型
 */
export type GameState = BroadcastGameState;

/**
 * 状态订阅者回调
 * state 可能为 null（reset 后）
 */
export type StateListener = (state: GameState | null, revision: number) => void;

/**
 * 状态存储接口
 */
export interface IGameStore {
  /** 获取当前状态 */
  getState(): GameState | null;

  /** 获取当前 revision */
  getRevision(): number;

  /** 订阅状态变化 */
  subscribe(listener: StateListener): () => void;

  /** 应用快照（玩家端） */
  applySnapshot(state: GameState, revision: number): void;
}

/**
 * 主机专用存储接口
 */
export interface IHostGameStore extends IGameStore {
  /** 设置状态（仅主机） */
  setState(state: GameState): void;

  /** 增量更新状态（仅主机） */
  updateState(updater: (state: GameState) => GameState): void;

  /** 初始化状态 */
  initialize(state: GameState): void;

  /** 重置 store（只清除 state，保留 listeners） */
  reset(): void;

  /** 完全销毁 store（包括 listeners，仅用于测试） */
  destroy(): void;
}
