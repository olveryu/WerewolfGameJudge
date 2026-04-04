/**
 * GameRoom Durable Object — WebSocket Hibernation API 实时房间
 *
 * 每个房间对应一个 DO 实例，管理该房间所有玩家的 WebSocket 连接。
 * Worker handler 在 game_state 变更后调用 DO 的 /broadcast 端点，
 * DO 将新 state 推送给所有已连接客户端。
 *
 * 使用 Hibernation API（webSocketMessage / webSocketClose）降低内存开销：
 * 空闲连接不占用 CPU 时间。
 *
 * 不包含游戏逻辑 — 纯粹的 WebSocket 广播中继。
 */

import type { Env } from '../env';

interface WebSocketAttachment {
  userId: string;
  roomCode: string;
  connectedAt: number;
}

export class GameRoom {
  readonly state: DurableObjectState;
  readonly env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * HTTP fetch handler — 两个入口：
   * 1. GET /websocket — 客户端升级为 WebSocket
   * 2. POST /broadcast — Worker handler 推送 state 变更
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/websocket') {
      return this.#handleWebSocketUpgrade(request);
    }

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.#handleBroadcast(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * WebSocket 升级 — 客户端通过此端点建立持久连接。
   * userId 和 roomCode 通过 query params 传递。
   */
  #handleWebSocketUpgrade(request: Request): Response {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');

    if (!userId || !roomCode) {
      return new Response('userId and roomCode required', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Attach metadata for identification
    const attachment: WebSocketAttachment = {
      userId,
      roomCode,
      connectedAt: Date.now(),
    };

    this.state.acceptWebSocket(server, [roomCode]);
    (server as unknown as { serializeAttachment(a: unknown): void }).serializeAttachment(
      attachment,
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Broadcast state to all connected WebSockets in this room.
   * Called by Worker handler after processGameAction succeeds.
   */
  async #handleBroadcast(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      state: unknown;
      revision: number;
      roomCode: string;
    };

    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      state: body.state,
      revision: body.revision,
    });

    const sockets = this.state.getWebSockets(body.roomCode);
    let sent = 0;
    for (const ws of sockets) {
      try {
        ws.send(message);
        sent++;
      } catch {
        // Socket already closed — will be cleaned up in webSocketClose
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Hibernation API — 收到客户端消息时唤醒。
   * 客户端可发送 ping / 自定义消息。
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);

    try {
      const parsed = JSON.parse(data);

      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch {
      // Non-JSON message — ignore
    }
  }

  /**
   * Hibernation API — WebSocket 关闭时清理。
   */
  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Hibernation API automatically removes the socket from getWebSockets()
    // No manual cleanup needed
    ws.close();
  }

  /**
   * Hibernation API — WebSocket 错误时清理。
   */
  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    ws.close();
  }
}
