/**
 * RoomLink — one room, one identity, one epoch at a time.
 *
 * Composes `LinkRuntime` (socket + status) and `CommandOutbox` (commands) and owns the
 * authoritative room snapshot. Every inbound snapshot — sync result, broadcast or committed
 * command — converges through one revision rule. Identity mismatches and revision conflicts are
 * protocol errors that close the link.
 */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type {
  BaseGameState,
  GameStateCodec,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { ServerFrame } from '@game-judge/game-engine/platform/realtime/protocol';

import type { PlatformEnvironment } from '@/platform/env/PlatformEnvironment';
import type { ApiClient } from '@/platform/http/ApiClient';

import { CommandOutbox } from './CommandOutbox';
import { createCommandTransport } from './commandTransport';
import type { LinkContext } from './linkReducer';
import { LinkRuntime } from './LinkRuntime';
import type { OutboxStorage } from './outboxStorage';
import { SocketChannel } from './SocketChannel';
import type {
  DispatchOptions,
  DispatchOutcome,
  LinkSnapshot,
  LinkStatus,
  PreparedCommand,
  RoomIdentity,
  RoomLink,
} from './types';

/** Grants one room at a time across every game module in the app. */
export interface RoomLease {
  /** Throws when another link already holds the lease; returns the release for this grant. */
  acquire(): () => void;
}

export function createRoomLease(): RoomLease {
  let release: (() => void) | null = null;
  return {
    acquire: () => {
      if (release !== null) {
        throw new Error('[FAIL-FAST] close() the active room before entering another room');
      }
      const grant = (): void => {
        if (release === grant) release = null;
      };
      release = grant;
      return grant;
    },
  };
}

export interface RoomLinkOptions<TState extends BaseGameState<string>> {
  readonly codec: GameStateCodec<TState>;
  readonly api: ApiClient;
  readonly lease: RoomLease;
  readonly socketBaseUrl: string;
  readonly environment: PlatformEnvironment;
  readonly outboxStorage: OutboxStorage;
  readonly newCommandId: () => string;
  readonly createSocket: (url: string) => WebSocket;
  readonly now: () => number;
  readonly random: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
  readonly onProtocolError: (error: Error) => void;
  readonly onInboxHint: () => void;
}

const EMPTY_PRESENCE: ReadonlySet<string> = Object.freeze(new Set<string>());
const IDLE_STATUS: LinkStatus = Object.freeze({ kind: 'idle' as const });

function idleSnapshot<TState extends BaseGameState<string>>(epoch: number): LinkSnapshot<TState> {
  return Object.freeze({
    epoch,
    identity: null,
    status: IDLE_STATUS,
    room: null,
    lastCommand: null,
    pendingDurableCount: 0,
    presence: EMPTY_PRESENCE,
  });
}

interface ActiveEpoch<TState extends BaseGameState<string>> {
  readonly epoch: number;
  readonly runtime: LinkRuntime<TState>;
  readonly outbox: CommandOutbox<TState>;
  readonly channel: SocketChannel<TState>;
  readonly releaseLease: () => void;
  snapshotFingerprint: string | null;
  readonly connectWaiters: Array<{ resolve(): void; reject(error: Error): void }>;
}

export class RoomLinkImpl<
  TState extends BaseGameState<string>,
  TCommand extends object,
> implements RoomLink<TState, TCommand> {
  readonly #options: RoomLinkOptions<TState>;
  readonly #listeners = new Set<() => void>();
  #snapshot: LinkSnapshot<TState> = idleSnapshot(0);
  #active: ActiveEpoch<TState> | null = null;

  constructor(options: RoomLinkOptions<TState>) {
    this.#options = options;
  }

  getSnapshot(): LinkSnapshot<TState> {
    return this.#snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async connect(identity: RoomIdentity<TState['gameType']>, signal: AbortSignal): Promise<void> {
    if (this.#active !== null) {
      throw new Error('[FAIL-FAST] close() the active room link before connect()');
    }
    if (identity.room.gameType !== this.#options.codec.gameType) {
      throw new Error(
        `RoomLink<${this.#options.codec.gameType}> cannot enter ${identity.room.gameType}`,
      );
    }
    if (identity.userId.length === 0) throw new Error('Room link userId must be non-empty');
    signal.throwIfAborted();

    const releaseLease = this.#options.lease.acquire();
    const epoch = this.#snapshot.epoch + 1;
    const active = this.#createEpoch(epoch, identity, releaseLease);
    this.#active = active;
    this.#publish(
      Object.freeze({
        epoch,
        identity,
        status: IDLE_STATUS,
        room: null,
        lastCommand: null,
        pendingDurableCount: 0,
        presence: EMPTY_PRESENCE,
      }),
    );

    const connected = new Promise<void>((resolve, reject) => {
      active.connectWaiters.push({ resolve, reject });
    });
    const onAbort = (): void => {
      if (this.#active === active) this.close();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      active.outbox.restore();
      active.runtime.start(identity.room);
      await connected;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  prepare<TPrepared extends TCommand>(
    command: TPrepared,
    controlledSeat: number | null,
  ): PreparedCommand<TPrepared> {
    return this.#requireActive().outbox.prepare(command, controlledSeat);
  }

  dispatch(command: TCommand, options: DispatchOptions): Promise<DispatchOutcome<TState>> {
    return this.#requireActive().outbox.dispatch(command, options);
  }

  dispatchPrepared<TPrepared extends TCommand>(
    prepared: PreparedCommand<TPrepared>,
    label: string,
  ): Promise<DispatchOutcome<TState>> {
    return this.#requireActive().outbox.dispatchPrepared(prepared, label);
  }

  retryNow(): void {
    this.#requireActive().runtime.retryNow();
  }

  close(): void {
    const active = this.#active;
    if (active === null) return;
    this.#active = null;
    active.outbox.dispose();
    active.runtime.close();
    active.releaseLease();
    const released = new Error('Room link released');
    for (const waiter of active.connectWaiters) waiter.reject(released);
    active.connectWaiters.length = 0;
    this.#publish(idleSnapshot(this.#snapshot.epoch));
  }

  // ─── Epoch wiring ─────────────────────────────────────────────────────────

  /** Callbacks are keyed on the epoch number so a replaced epoch's late events are ignored. */
  #createEpoch(
    epoch: number,
    identity: RoomIdentity<TState['gameType']>,
    releaseLease: () => void,
  ): ActiveEpoch<TState> {
    const options = this.#options;
    const forEpoch = (): ActiveEpoch<TState> | null =>
      this.#active !== null && this.#active.epoch === epoch ? this.#active : null;

    const channel = new SocketChannel<TState>({
      baseUrl: options.socketBaseUrl,
      codec: options.codec,
      accessToken: () => options.api.ensureFreshAccessToken(),
      createSocket: options.createSocket,
      events: {
        onOpen: (generation) => forEpoch()?.runtime.handleSocketOpen(generation),
        onClose: (generation, code) => forEpoch()?.runtime.handleSocketClose(generation, code),
        onFrame: (generation, frame) => forEpoch()?.runtime.handleFrame(generation, frame),
        onPong: (generation) => forEpoch()?.runtime.handlePong(generation),
        onProtocolError: (generation, error) =>
          forEpoch()?.runtime.handleProtocolError(generation, error),
      },
    });
    const runtime = new LinkRuntime<TState>({
      channel,
      environment: options.environment,
      now: options.now,
      random: options.random,
      setTimeout: options.setTimeout,
      clearTimeout: options.clearTimeout,
      owner: {
        onStatus: (status, context) => {
          const active = forEpoch();
          if (active !== null) this.#handleStatus(active, status, context);
        },
        onFrame: (frame) => {
          const active = forEpoch();
          if (active !== null) this.#handleFrame(active, frame);
        },
        onProtocolError: options.onProtocolError,
      },
    });
    const outbox = new CommandOutbox<TState>({
      identity,
      epoch,
      transport: createCommandTransport(options.api, options.codec),
      storage: options.outboxStorage,
      newCommandId: options.newCommandId,
      now: options.now,
      setTimeout: options.setTimeout,
      clearTimeout: options.clearTimeout,
      onCommitted: (outcome) => {
        const active = forEpoch();
        if (active !== null) this.#applySnapshot(active, outcome.snapshot, null);
      },
      onPendingDurableCount: (count) => {
        if (forEpoch() === null || this.#snapshot.pendingDurableCount === count) return;
        this.#publish(Object.freeze({ ...this.#snapshot, pendingDurableCount: count }));
      },
    });
    return {
      epoch,
      channel,
      runtime,
      outbox,
      releaseLease,
      snapshotFingerprint: null,
      connectWaiters: [],
    };
  }

  #handleStatus(active: ActiveEpoch<TState>, status: LinkStatus, context: LinkContext): void {
    if (this.#active !== active) return;
    this.#publish(Object.freeze({ ...this.#snapshot, status }));
    active.outbox.setLiveGeneration(status.kind === 'live' ? context.socketGeneration : null);
    if (status.kind === 'live') {
      if (this.#snapshot.room === null) {
        throw new Error('[FAIL-FAST] Link became live without a room snapshot');
      }
      for (const waiter of active.connectWaiters) waiter.resolve();
      active.connectWaiters.length = 0;
    } else if (status.kind === 'closed') {
      const error = new Error(`Room link closed: ${status.reason}`);
      for (const waiter of active.connectWaiters) waiter.reject(error);
      active.connectWaiters.length = 0;
      active.outbox.dispose();
    }
  }

  #handleFrame(active: ActiveEpoch<TState>, frame: ServerFrame<TState>): void {
    if (this.#active !== active) return;
    switch (frame.type) {
      case 'SYNC_RESULT':
        if (frame.outcome === 'snapshot') {
          this.#applySnapshot(active, frame.snapshot, null);
        } else if (
          this.#snapshot.room === null ||
          this.#snapshot.room.revision !== frame.revision
        ) {
          active.runtime.failProtocol(
            new Error(
              `SYNC_RESULT current at revision ${frame.revision} but client holds ${this.#snapshot.room?.revision ?? 'none'}`,
            ),
          );
        }
        return;
      case 'STATE_UPDATE':
        this.#applySnapshot(active, frame.snapshot, frame.commandType);
        return;
      case 'PRESENCE':
        this.#publish(
          Object.freeze({
            ...this.#snapshot,
            presence: Object.freeze(new Set(frame.onlineUserIds)),
          }),
        );
        return;
      case 'INBOX_HINT':
        this.#options.onInboxHint();
        return;
    }
  }

  /** Revision rule: older ignored; equal must be byte-identical; newer replaces. */
  #applySnapshot(
    active: ActiveEpoch<TState>,
    snapshot: RoomSnapshot<TState>,
    commandType: string | null,
  ): void {
    if (this.#active !== active) return;
    const current = this.#snapshot;
    const identity = current.identity;
    if (identity === null) throw new Error('[FAIL-FAST] Snapshot arrived without an identity');
    if (
      snapshot.gameType !== identity.room.gameType ||
      snapshot.state.roomCode !== identity.room.roomCode ||
      snapshot.state.hostUserId !== identity.room.hostUserId
    ) {
      active.runtime.failProtocol(new Error('Room snapshot identity does not match the directory'));
      return;
    }

    const fingerprint = canonicalJson(snapshot);
    if (current.room !== null) {
      if (snapshot.revision < current.room.revision) return;
      if (snapshot.revision === current.room.revision) {
        if (fingerprint !== active.snapshotFingerprint) {
          active.runtime.failProtocol(
            new Error(`Room revision ${snapshot.revision} changed its snapshot payload`),
          );
          return;
        }
        if (commandType === null || current.lastCommand?.type === commandType) return;
        this.#publish(
          Object.freeze({
            ...current,
            lastCommand: { revision: snapshot.revision, type: commandType },
          }),
        );
        return;
      }
    }

    active.snapshotFingerprint = fingerprint;
    active.runtime.noteRevision(snapshot.revision);
    this.#publish(
      Object.freeze({
        ...current,
        room: snapshot,
        lastCommand:
          commandType === null ? null : { revision: snapshot.revision, type: commandType },
      }),
    );
  }

  #requireActive(): ActiveEpoch<TState> {
    if (this.#active === null) throw new Error('[FAIL-FAST] No active room link');
    return this.#active;
  }

  #publish(snapshot: LinkSnapshot<TState>): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}
