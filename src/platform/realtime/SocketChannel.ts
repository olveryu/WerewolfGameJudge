/**
 * SocketChannel — one room WebSocket at a time, with strict inbound parsing.
 *
 * Owns socket creation (URL, token), teardown and frame decoding. Every socket carries the
 * reducer's generation so late events from a replaced socket are ignored. A frame that fails
 * the shared parser or a `STATE_UPDATE` whose revision does not advance closes the socket with
 * 1002. Reconnection, timers and status live in `LinkRuntime`; this class has no policy.
 */
import type { RoomLocator } from '@game-judge/game-engine/platform/protocol/roomLocator';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import {
  type ClientFrame,
  parseServerFrame,
  type ServerFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';

export interface SocketChannelEvents<TState extends BaseGameState<string>> {
  onOpen(generation: number): void;
  onClose(generation: number, code: number, reason: string): void;
  onFrame(generation: number, frame: ServerFrame<TState>): void;
  onPong(generation: number): void;
  /** The channel already closed the socket with 1002; the runtime decides what that means. */
  onProtocolError(generation: number, error: Error): void;
}

export interface SocketChannelOptions<TState extends BaseGameState<string>> {
  readonly baseUrl: string;
  readonly codec: GameStateCodec<TState>;
  readonly accessToken: () => Promise<string | null>;
  readonly createSocket: (url: string) => WebSocket;
  readonly events: SocketChannelEvents<TState>;
}

const PING_TEXT = 'ping';
const PONG_TEXT = 'pong';

interface ActiveSocket {
  readonly generation: number;
  readonly socket: WebSocket;
  lastRevision: number;
}

export class SocketChannel<TState extends BaseGameState<string>> {
  readonly #options: SocketChannelOptions<TState>;
  #active: ActiveSocket | null = null;
  /** Generation whose open() is still awaiting a token; superseded opens are dropped. */
  #opening: number | null = null;

  constructor(options: SocketChannelOptions<TState>) {
    if (!/^wss?:\/\//.test(options.baseUrl)) {
      throw new Error('SocketChannel baseUrl must use ws:// or wss://');
    }
    this.#options = options;
  }

  /**
   * Open a socket for `generation`. Rejects with `authRejected` semantics by closing 4002 when no
   * token is available, so the reducer sees one consistent terminal path.
   */
  async open(generation: number, room: RoomLocator): Promise<void> {
    this.closeActive(1000, 'superseded');
    this.#opening = generation;
    const token = await this.#options.accessToken();
    if (this.#opening !== generation) return;
    this.#opening = null;
    if (token === null) {
      this.#options.events.onClose(generation, REALTIME_CLOSE_CODE.AUTH_REJECTED, 'no_token');
      return;
    }

    const url =
      `${this.#options.baseUrl}/ws?roomCode=${encodeURIComponent(room.roomCode)}` +
      `&roomId=${encodeURIComponent(room.roomId)}&token=${encodeURIComponent(token)}`;
    const socket = this.#options.createSocket(url);
    const active: ActiveSocket = { generation, socket, lastRevision: 0 };
    this.#active = active;

    socket.onopen = () => {
      if (this.#active !== active) return;
      this.#options.events.onOpen(generation);
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.#active !== active) return;
      this.#receive(active, event.data);
    };
    socket.onclose = (event: CloseEvent) => {
      if (this.#active !== active) return;
      this.#active = null;
      this.#options.events.onClose(generation, event.code, event.reason);
    };
    socket.onerror = () => {
      // Browsers always follow onerror with onclose; the close code is the diagnostic.
    };
  }

  /** Send a client frame on the socket of `generation`; false when that socket is not open. */
  send(generation: number, frame: ClientFrame): boolean {
    return this.#sendText(generation, JSON.stringify(frame));
  }

  ping(generation: number): boolean {
    return this.#sendText(generation, PING_TEXT);
  }

  /** Close the socket of `generation` if it is still the active one. */
  close(generation: number, code: number, reason: string): void {
    if (this.#opening === generation) this.#opening = null;
    if (this.#active?.generation !== generation) return;
    this.closeActive(code, reason);
  }

  closeActive(code: number, reason: string): void {
    const active = this.#active;
    if (active === null) return;
    this.#active = null;
    active.socket.onopen = null;
    active.socket.onmessage = null;
    active.socket.onclose = null;
    active.socket.onerror = null;
    active.socket.close(code, reason);
  }

  #sendText(generation: number, text: string): boolean {
    const active = this.#active;
    if (active === null || active.generation !== generation) return false;
    if (active.socket.readyState !== WebSocket.OPEN) return false;
    active.socket.send(text);
    return true;
  }

  #receive(active: ActiveSocket, data: unknown): void {
    if (data === PONG_TEXT) {
      this.#options.events.onPong(active.generation);
      return;
    }
    let frame: ServerFrame<TState>;
    try {
      if (typeof data !== 'string') throw new Error('Realtime frame must be text');
      frame = parseServerFrame(JSON.parse(data), this.#options.codec);
      if (frame.type === 'STATE_UPDATE') {
        if (frame.snapshot.revision <= active.lastRevision) {
          throw new Error(
            `STATE_UPDATE revision ${frame.snapshot.revision} did not advance from ${active.lastRevision}`,
          );
        }
        active.lastRevision = frame.snapshot.revision;
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.closeActive(REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol_error');
      this.#options.events.onProtocolError(active.generation, failure);
      return;
    }
    this.#options.events.onFrame(active.generation, frame);
  }
}
