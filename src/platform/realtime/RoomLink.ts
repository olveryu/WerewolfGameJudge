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
import { ApiError } from '@/platform/http/ApiError';

import { CommandOutbox } from './CommandOutbox';
import { createCommandTransport } from './commandTransport';
import type { LinkContext } from './linkReducer';
import { LinkRuntime } from './LinkRuntime';
import type { OutboxStorage } from './outboxStorage';
import { type AccessTokenOutcome, type RealtimeSocket, SocketChannel } from './SocketChannel';
import type {
  DispatchOptions,
  DispatchOutcome,
  InboxWakeReason,
  LinkSnapshot,
  LinkStatus,
  RoomIdentity,
  RoomLink,
  TimerHandle,
} from './types';
import { RoomLinkClosedError } from './types';

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
  readonly createSocket: (url: string) => RealtimeSocket;
  readonly now: () => number;
  readonly random: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  readonly clearTimeout: (handle: TimerHandle) => void;
  readonly onProtocolError: (error: Error) => void;
  readonly onInboxWake: (reason: InboxWakeReason) => void;
}

const EMPTY_PRESENCE: ReadonlySet<string> = Object.freeze(new Set<string>());
const IDLE_STATUS: LinkStatus = Object.freeze({ kind: 'idle' as const });

/**
 * Token lookup for the upgrade. A replaced session (`aborted`) means this link's user is gone:
 * terminal. Any other `ApiError` is the auth endpoint being unreachable or broken, which ApiClient
 * already logged: one failed attempt. Anything else is a programming error and propagates.
 */
async function readAccessToken(api: ApiClient): Promise<AccessTokenOutcome> {
  try {
    const token = await api.ensureFreshAccessToken();
    return token === null ? { kind: 'none' } : { kind: 'token', token };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return error.kind === 'aborted' ? { kind: 'none' } : { kind: 'unavailable' };
  }
}

/** Flat fields the link mutates; `buildSnapshot` derives the phase-discriminated snapshot. */
interface LinkFields<TState extends BaseGameState<string>> {
  readonly epoch: number;
  readonly identity: RoomIdentity<TState['gameType']> | null;
  readonly status: LinkStatus;
  readonly room: RoomSnapshot<TState> | null;
  readonly lastCommand: { readonly revision: number; readonly type: string } | null;
  readonly pendingDurableCount: number;
  readonly presence: ReadonlySet<string>;
}

function idleFields<TState extends BaseGameState<string>>(epoch: number): LinkFields<TState> {
  return {
    epoch,
    identity: null,
    status: IDLE_STATUS,
    room: null,
    lastCommand: null,
    pendingDurableCount: 0,
    presence: EMPTY_PRESENCE,
  };
}

function buildSnapshot<TState extends BaseGameState<string>>(
  fields: LinkFields<TState>,
): LinkSnapshot<TState> {
  const { identity, room, status, ...rest } = fields;
  if (identity === null) {
    if (room !== null || status.kind === 'closed') {
      throw new Error('[FAIL-FAST] Link without identity cannot hold a room or be closed');
    }
    return Object.freeze({ ...rest, status, phase: 'idle', identity, room });
  }
  if (status.kind === 'closed') {
    return Object.freeze({ ...rest, status, phase: 'closed', identity, room });
  }
  if (room === null) return Object.freeze({ ...rest, status, phase: 'entering', identity, room });
  return Object.freeze({ ...rest, status, phase: 'ready', identity, room });
}

interface ActiveEpoch<TState extends BaseGameState<string>> {
  readonly epoch: number;
  readonly runtime: LinkRuntime<TState>;
  readonly outbox: CommandOutbox<TState>;
  readonly channel: SocketChannel<TState>;
  readonly releaseLease: () => void;
  /** Canonical JSON of the applied room snapshot, computed only when an equal revision arrives. */
  appliedFingerprint: string | null;
  readonly connectWaiters: Array<{ resolve(): void; reject(error: Error): void }>;
}

export class RoomLinkImpl<
  TState extends BaseGameState<string>,
  TCommand extends object,
> implements RoomLink<TState, TCommand> {
  readonly #options: RoomLinkOptions<TState>;
  readonly #listeners = new Set<() => void>();
  #fields: LinkFields<TState> = idleFields(0);
  #snapshot: LinkSnapshot<TState> = buildSnapshot(this.#fields);
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
    const epoch = this.#fields.epoch + 1;
    const active = this.#createEpoch(epoch, identity, releaseLease);
    this.#active = active;
    this.#replace({ ...idleFields<TState>(epoch), identity });

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
    } catch (error) {
      // Start-up failed before any socket existed: give the lease back so the error is retryable.
      signal.removeEventListener('abort', onAbort);
      connected.catch(() => undefined);
      this.close();
      throw error;
    }
    try {
      await connected;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  dispatch(command: TCommand, options: DispatchOptions): Promise<DispatchOutcome<TState>> {
    return this.#requireActive().outbox.dispatch(command, options);
  }

  retryNow(): void {
    // The button renders only while waiting; a press that lands after close() has nothing to retry.
    this.#active?.runtime.retryNow();
  }

  close(): void {
    const active = this.#active;
    if (active === null) return;
    this.#active = null;
    active.outbox.dispose();
    active.runtime.close();
    active.releaseLease();
    const released = new RoomLinkClosedError('released');
    for (const waiter of active.connectWaiters) waiter.reject(released);
    active.connectWaiters.length = 0;
    this.#replace(idleFields(this.#fields.epoch));
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
      accessToken: () => readAccessToken(options.api),
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
        if (forEpoch() === null || this.#fields.pendingDurableCount === count) return;
        this.#update({ pendingDurableCount: count });
      },
    });
    return {
      epoch,
      channel,
      runtime,
      outbox,
      releaseLease,
      appliedFingerprint: null,
      connectWaiters: [],
    };
  }

  #handleStatus(active: ActiveEpoch<TState>, status: LinkStatus, context: LinkContext): void {
    if (this.#active !== active) return;
    this.#update({ status });
    active.outbox.setLiveGeneration(status.kind === 'live' ? context.socketGeneration : null);
    if (status.kind === 'live') {
      if (this.#fields.room === null) {
        throw new Error('[FAIL-FAST] Link became live without a room snapshot');
      }
      for (const waiter of active.connectWaiters) waiter.resolve();
      active.connectWaiters.length = 0;
      this.#options.onInboxWake('live');
    } else if (status.kind === 'closed') {
      const error = new RoomLinkClosedError(status.reason);
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
        } else if (this.#fields.room === null || this.#fields.room.revision !== frame.revision) {
          active.runtime.failProtocol(
            new Error(
              `SYNC_RESULT current at revision ${frame.revision} but client holds ${this.#fields.room?.revision ?? 'none'}`,
            ),
          );
        }
        return;
      case 'STATE_UPDATE':
        this.#applySnapshot(active, frame.snapshot, frame.commandType);
        return;
      case 'PRESENCE':
        this.#update({ presence: Object.freeze(new Set(frame.onlineUserIds)) });
        return;
      case 'INBOX_HINT':
        this.#options.onInboxWake('hint');
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
    const current = this.#fields;
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

    if (current.room !== null) {
      if (snapshot.revision < current.room.revision) return;
      if (snapshot.revision === current.room.revision) {
        // Own commands arrive twice at one revision (HTTP result + broadcast); compare bytes then.
        active.appliedFingerprint ??= canonicalJson(current.room);
        if (canonicalJson(snapshot) !== active.appliedFingerprint) {
          active.runtime.failProtocol(
            new Error(`Room revision ${snapshot.revision} changed its snapshot payload`),
          );
          return;
        }
        if (commandType === null || current.lastCommand?.type === commandType) return;
        this.#update({ lastCommand: { revision: snapshot.revision, type: commandType } });
        return;
      }
    }

    active.appliedFingerprint = null;
    active.runtime.noteRevision(snapshot.revision);
    this.#update({
      room: snapshot,
      lastCommand: commandType === null ? null : { revision: snapshot.revision, type: commandType },
    });
  }

  #requireActive(): ActiveEpoch<TState> {
    if (this.#active === null) throw new Error('[FAIL-FAST] No active room link');
    return this.#active;
  }

  #update(patch: Partial<LinkFields<TState>>): void {
    this.#replace({ ...this.#fields, ...patch });
  }

  #replace(fields: LinkFields<TState>): void {
    this.#fields = fields;
    this.#snapshot = buildSnapshot(fields);
    for (const listener of this.#listeners) listener();
  }
}
