/**
 * TransportAdapter - BroadcastService → ITransport 适配器
 *
 * 职责：
 * - 将 BroadcastService 适配为 ITransport 接口
 * - 提供 sendState / sendMessage / onPlayerMessage 等统一传输 API
 *
 * ✅ 允许：消息转发 + 事件代理
 * ❌ 禁止：游戏逻辑（校验/结算/流程推进）
 */

import type { BroadcastService } from './BroadcastService';
import type { HostBroadcast, PlayerMessage as ProtocolPlayerMessage } from '@/services/protocol/types';
import type { GameState } from '@/services/engine/store/types';

/**
 * Transport 监听器
 */
export interface TransportListener {
  /** 收到状态更新 */
  onStateUpdate?: (state: GameState, revision: number) => void;
  /** 收到玩家消息 */
  onPlayerMessage?: (message: ProtocolPlayerMessage, senderUid: string) => void;
  /** 连接状态变化 */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Transport 接口
 */
interface ITransport {
  /** 广播状态给所有玩家 */
  broadcastState(state: GameState, revision: number): Promise<void>;

  /** 发送消息给 Host */
  sendToHost(message: ProtocolPlayerMessage): Promise<void>;

  /** 订阅消息 */
  subscribe(listener: TransportListener): () => void;

  /** 断开连接 */
  disconnect(): Promise<void>;
}

/**
 * TransportAdapter - 将 BroadcastService 适配为 ITransport
 *
 * 注意：BroadcastService 使用 callback 模式（joinRoom 时传入 handlers），
 * 而 TransportAdapter 提供 subscribe 模式。这个适配器在两者之间做桥接。
 */
export class TransportAdapter implements ITransport {
  private readonly listeners: Set<TransportListener> = new Set();

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly isHost: boolean,
  ) {}

  /**
   * 广播状态给所有玩家（仅 Host）
   */
  async broadcastState(state: GameState, revision: number): Promise<void> {
    if (!this.isHost) {
      throw new Error('Only host can broadcast state');
    }

    const message: HostBroadcast = {
      type: 'STATE_UPDATE',
      state,
      revision,
    };

    await this.broadcastService.broadcastAsHost(message);
  }

  /**
   * 发送消息给 Host（仅 Player）
   */
  async sendToHost(message: ProtocolPlayerMessage): Promise<void> {
    if (this.isHost) {
      throw new Error('Host cannot send to host');
    }

    await this.broadcastService.sendToHost(message);
  }

  /**
   * 订阅消息
   *
   * 注意：实际的事件订阅是在 joinRoom 时通过 callbacks 完成的。
   * 这里只管理本地 listeners，由外部（如 GameFacade）
   * 将 BroadcastService 的 callbacks 桥接到这些 listeners。
   */
  subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取所有 listeners（供外部桥接使用）
   */
  getListeners(): ReadonlySet<TransportListener> {
    return this.listeners;
  }

  /**
   * 通知状态更新（供外部桥接调用）
   */
  notifyStateUpdate(state: GameState, revision: number): void {
    for (const listener of this.listeners) {
      listener.onStateUpdate?.(state, revision);
    }
  }

  /**
   * 通知玩家消息（供外部桥接调用）
   */
  notifyPlayerMessage(message: ProtocolPlayerMessage, senderUid: string): void {
    for (const listener of this.listeners) {
      listener.onPlayerMessage?.(message, senderUid);
    }
  }

  /**
   * 通知连接状态变化（供外部桥接调用）
   */
  notifyConnectionChange(connected: boolean): void {
    for (const listener of this.listeners) {
      listener.onConnectionChange?.(connected);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.listeners.clear();
  }
}
