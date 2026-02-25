/**
 * Store Types - 状态存储类型定义
 *
 * GameState 定义在 protocol/types.ts（单一真相），此处 re-export 供 store 层消费者使用。
 */

// Re-export from protocol (canonical definition)
export type { GameState } from '../../protocol/types';
import type { GameState } from '../../protocol/types';

/**
 * 状态订阅者回调（Store 层）
 * state 可能为 null（reset 后）
 */
export type StoreStateListener = (state: GameState | null, revision: number) => void;

/**
 * 状态存储接口
 */
interface IGameStore {
  /** 获取当前状态 */
  getState(): GameState | null;

  /** 获取当前 revision */
  getRevision(): number;

  /** 订阅状态变化 */
  subscribe(listener: StoreStateListener): () => void;

  /** 应用快照（玩家端） */
  applySnapshot(state: GameState, revision: number): void;

  /** 乐观更新（发 fetch 前立即渲染预测 state） */
  applyOptimistic(state: GameState): void;

  /** 回滚乐观更新（服务端拒绝时） */
  rollbackOptimistic(): void;
}

/**
 * 可写存储接口（含 setState/updateState/initialize/reset/destroy）
 */
export interface IWritableGameStore extends IGameStore {
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
