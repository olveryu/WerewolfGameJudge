/**
 * LinkRuntime — imperative shell around `linkReducer`.
 *
 * Owns timers, the environment subscription and the `SocketChannel`; translates their events
 * into reducer events and executes the effects the reducer returns. Frames that carry room data
 * are forwarded to the owner untouched; the runtime never interprets snapshots.
 */
import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import type { RoomLocator } from '@game-judge/game-engine/platform/protocol/roomLocator';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import {
  createSyncFrame,
  type ServerFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';

import type { PlatformEnvironment } from '@/platform/env/PlatformEnvironment';

import {
  createInitialContext,
  type LinkContext,
  type LinkEffect,
  type LinkEvent,
  reduceLink,
  type TimerKind,
} from './linkReducer';
import type { SocketChannel } from './SocketChannel';
import type { LinkStatus, TimerHandle } from './types';

export interface LinkRuntimeOwner<TState extends BaseGameState<string>> {
  onStatus(status: LinkStatus, context: LinkContext): void;
  /** Delivered for every data frame; the owner validates and applies snapshots. */
  onFrame(frame: ServerFrame<TState>): void;
  onProtocolError(error: Error): void;
}

export interface LinkRuntimeOptions<TState extends BaseGameState<string>> {
  readonly channel: SocketChannel<TState>;
  readonly environment: PlatformEnvironment;
  readonly owner: LinkRuntimeOwner<TState>;
  readonly now: () => number;
  readonly random: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  readonly clearTimeout: (handle: TimerHandle) => void;
}

export class LinkRuntime<TState extends BaseGameState<string>> {
  readonly #options: LinkRuntimeOptions<TState>;
  readonly #timers = new Map<TimerKind, TimerHandle>();
  #context: LinkContext;
  #room: RoomLocator | null = null;
  #unsubscribeEnvironment: (() => void) | null = null;

  constructor(options: LinkRuntimeOptions<TState>) {
    this.#options = options;
    const env = options.environment.getSnapshot();
    this.#context = createInitialContext({
      online: env.online,
      visible: env.visible,
      nowMs: options.now(),
    });
  }

  get context(): LinkContext {
    return this.#context;
  }

  /** Bind the room and start the first attempt. Must be idle. */
  start(room: RoomLocator): void {
    this.#room = room;
    this.#unsubscribeEnvironment = this.#options.environment.subscribe(() => {
      const env = this.#options.environment.getSnapshot();
      this.#dispatch({ type: 'ENV', online: env.online, visible: env.visible });
    });
    const env = this.#options.environment.getSnapshot();
    this.#dispatch({ type: 'ENV', online: env.online, visible: env.visible });
    this.#dispatch({ type: 'CONNECT' });
  }

  /** Tell the reducer which revision the owner now holds, so SYNC can ask for a delta. */
  noteRevision(revision: number): void {
    this.#dispatch({ type: 'REVISION', revision });
  }

  retryNow(): void {
    this.#dispatch({ type: 'RETRY_NOW' });
  }

  /** Terminal: close the socket and stop all timers and subscriptions. */
  close(): void {
    this.#dispatch({ type: 'CLOSE' });
    this.#teardown();
  }

  // ─── Channel events (wired by RoomLink) ───────────────────────────────────

  handleSocketOpen(generation: number): void {
    this.#dispatch({ type: 'SOCKET_OPEN', generation });
  }

  handleSocketClose(generation: number, code: number): void {
    this.#dispatch({ type: 'SOCKET_CLOSED', generation, code });
    if (this.#context.status.kind === 'closed') this.#teardown();
  }

  handleFrame(generation: number, frame: ServerFrame<TState>): void {
    if (generation !== this.#context.socketGeneration) return;
    switch (frame.type) {
      case 'SYNC_RESULT':
        // The owner applies the snapshot before the reducer marks the link live.
        this.#options.owner.onFrame(frame);
        this.#dispatch({ type: 'SYNC_RESULT', generation, requestId: frame.requestId });
        return;
      case 'STATE_UPDATE':
        this.#options.owner.onFrame(frame);
        this.#dispatch({ type: 'STATE_UPDATE', generation });
        return;
      case 'PRESENCE':
      case 'INBOX_HINT':
        this.#options.owner.onFrame(frame);
        return;
    }
  }

  handlePong(generation: number): void {
    this.#dispatch({ type: 'PONG', generation });
  }

  handleProtocolError(generation: number, error: Error): void {
    if (generation !== this.#context.socketGeneration) return;
    this.#options.owner.onProtocolError(error);
    this.#dispatch({ type: 'PROTOCOL_ERROR' });
    this.#teardown();
  }

  /** Owner-detected protocol violation in a frame payload (identity, revision, codec). */
  failProtocol(error: Error): void {
    this.#options.owner.onProtocolError(error);
    this.#dispatch({ type: 'PROTOCOL_ERROR' });
    this.#teardown();
  }

  // ─── Dispatch / effects ───────────────────────────────────────────────────

  readonly #queue: LinkEvent[] = [];
  #draining = false;

  /** Events raised while executing effects are queued so each transition's effects run intact. */
  #dispatch(event: LinkEvent): void {
    this.#queue.push(event);
    if (this.#draining) return;
    this.#draining = true;
    try {
      for (let next = this.#queue.shift(); next !== undefined; next = this.#queue.shift()) {
        this.#transition(next);
      }
    } finally {
      this.#draining = false;
    }
  }

  #transition(event: LinkEvent): void {
    const previous = this.#context;
    const { context, effects } = reduceLink(previous, event, {
      nowMs: this.#options.now(),
      random: this.#options.random,
      newRequestId,
    });
    this.#context = context;
    for (const effect of effects) this.#execute(effect);
    if (context.status !== previous.status) this.#options.owner.onStatus(context.status, context);
  }

  #execute(effect: LinkEffect): void {
    const { channel } = this.#options;
    switch (effect.type) {
      case 'OPEN_SOCKET': {
        const room = this.#room;
        if (room === null) throw new Error('[FAIL-FAST] OPEN_SOCKET before start()');
        void channel.open(effect.generation, room);
        return;
      }
      case 'CLOSE_SOCKET':
        channel.close(effect.generation, effect.code, 'client_close');
        return;
      case 'SEND_SYNC': {
        const sent = channel.send(
          effect.generation,
          createSyncFrame(effect.requestId, effect.knownRevision),
        );
        if (!sent)
          this.#dispatch({ type: 'SOCKET_CLOSED', generation: effect.generation, code: 1006 });
        return;
      }
      case 'SEND_PING': {
        const sent = channel.ping(effect.generation);
        if (!sent)
          this.#dispatch({ type: 'SOCKET_CLOSED', generation: effect.generation, code: 1006 });
        return;
      }
      case 'ARM_TIMER': {
        this.#disarm(effect.kind);
        const delayMs = Math.max(0, effect.atMs - this.#options.now());
        const handle = this.#options.setTimeout(() => {
          this.#timers.delete(effect.kind);
          this.#dispatch({ type: 'TIMER', kind: effect.kind });
        }, delayMs);
        this.#timers.set(effect.kind, handle);
        return;
      }
      case 'DISARM_TIMER':
        this.#disarm(effect.kind);
        return;
    }
  }

  #disarm(kind: TimerKind): void {
    const handle = this.#timers.get(kind);
    if (handle === undefined) return;
    this.#options.clearTimeout(handle);
    this.#timers.delete(kind);
  }

  #teardown(): void {
    for (const kind of [...this.#timers.keys()]) this.#disarm(kind);
    this.#unsubscribeEnvironment?.();
    this.#unsubscribeEnvironment = null;
    this.#options.channel.closeActive(1000, 'client_close');
  }
}
