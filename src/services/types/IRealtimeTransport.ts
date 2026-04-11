/**
 * IRealtimeTransport — WebSocket 传输层接口
 *
 * 定义 WebSocket 原子操作的公共契约。ConnectionManager 通过此接口
 * 操作 WebSocket，不直接依赖具体实现（CFRealtimeService）。
 *
 * 职责边界：
 * - 做什么：URL 构建、WebSocket 创建/销毁、消息解析、连接超时
 * - 不做什么：重连、退避、ping/pong timer、状态管理、平台事件监听
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers (transport → ConnectionManager)
// ─────────────────────────────────────────────────────────────────────────────

export interface SettleResultMessage {
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  reward?: { type: string; id: string };
}

export interface TransportEventHandlers {
  onOpen(): void;
  onClose(code: number, reason: string): void;
  onError(error: unknown): void;
  onStateUpdate(state: GameState, revision: number, lastAction?: string): void;
  onSettleResult(result: SettleResultMessage): void;
  onPong(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IRealtimeTransport {
  /**
   * 建立 WebSocket 连接。
   * 内置 8s 连接超时。超时/失败通过 handlers.onClose / handlers.onError 通知。
   * 不含任何重连逻辑。
   */
  connect(roomCode: string, userId: string): void;

  /**
   * 关闭当前 WebSocket。
   * 关闭后不触发 handlers（调用方已知此为主动关闭）。
   */
  disconnect(): void;

  /**
   * 发送文本消息到 WebSocket。
   * 仅在 WS readyState === OPEN 时发送，否则静默忽略。
   */
  send(data: string): void;

  /**
   * 注册事件处理器（transport 将 WS 事件翻译为类型化回调）。
   * 必须在 connect() 之前调用。
   */
  setEventHandlers(handlers: TransportEventHandlers): void;
}
