/**
 * Store Types - 状态存储类型定义
 *
 * GameState 定义在 protocol/types.ts（唯一权威）。
 * Store 是 parse boundary：input 接收 GameState，output 返回 GameState。
 */

// Re-export from protocol (canonical definition)
export type { GameState } from '../../protocol/types';
import type { GameState } from '../../protocol/types';

/**
 * 状态订阅者回调（Store 层）
 * state 可能为 null（reset 后），非 null 时为 normalized 后的 GameState
 */
export type StoreStateListener = (state: GameState | null, revision: number) => void;

/**
 * 状态存储接口
 */
interface IGameStore {
  /** 获取当前状态（normalized 后的 GameState） */
  getState(): GameState | null;

  /** 获取当前 revision */
  getRevision(): number;

  /** 订阅状态变化 */
  subscribe(listener: StoreStateListener): () => void;

  /** 应用快照（玩家端）— 接收 wire payload，内部 normalize */
  applySnapshot(state: GameState, revision: number, lastAction?: string): void;

  /** 消费最近一次广播携带的 lastAction（一次性读取，读后清除） */
  consumeLastAction(): string | null;

  /** 乐观更新（发 fetch 前立即渲染预测 state）— 接收 wire payload，内部 normalize */
  applyOptimistic(state: GameState): void;

  /** 回滚乐观更新（服务端拒绝时） */
  rollbackOptimistic(): void;
}

/**
 * 可写存储接口（含 setState/updateState/initialize/reset/destroy）
 */
export interface IWritableGameStore extends IGameStore {
  /** 设置状态（仅主机）— 接收 raw state，内部 normalize */
  setState(state: GameState): void;

  /** 增量更新状态（仅主机）— updater 读到 GameState，返回 GameState */
  updateState(updater: (state: GameState) => GameState): void;

  /** 初始化状态 — 接收 raw state，内部 normalize */
  initialize(state: GameState): void;

  /** 重置 store（只清除 state，保留 listeners） */
  reset(): void;

  /** 完全销毁 store（包括 listeners，仅用于测试） */
  destroy(): void;
}
